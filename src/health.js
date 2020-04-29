const axios = require('axios');
const CryptoJS = require('crypto-js');
const isEqual = require('lodash.isequal');

const logger = require('./logger');

const TelegramBot = require('node-telegram-bot-api');
const Agent = require('socks5-https-client/lib/Agent');

const token = process.env.KVANT_HEALTH_METER_TOKEN;
const chatId = process.env.KVANT_HEALTH_METER_CHAT_ID;

const bot = new TelegramBot(token, {
	polling: true,
	request: {
        agentClass: Agent,
        agentOptions: {
            socksHost: '104.248.63.17',
            socksPort: 30588,
        }
	}
});

bot.onText(/\/status/, (msg, match) => {
  getHealthStatus(true, false);
});

bot.onText(/\/details/, (msg, match) => {
  getHealthStatus(true, true);
});

async function sendTelegram(message) {
	await bot.sendMessage(chatId, message);
}

const TEN_MINUTE = 10*60*1000;

const nodeURLs = ['http://server-node1.kvant.io','http://server-node2.kvant.io','http://server-node3.kvant.io','http://server-node4.kvant.io'];

const port = 12000;

const apiURLs = {
	validators: 'validators',
	status: 'status',
	net: 'net_info',
	candidate: 'candidate?pub_key=%PARAM%'
}

function formURL(base, port, route, param) {
	let res = base + ':' + port + '/' + route;
	if (param) {
		res = res.replace('%PARAM%',param);
	}
	return res;
}

let prevErrorList = [];

async function getHealthStatus(forceShowInfo, showHealthObjectInfo) {
	//sendTelegram('test');
	let health = {}, errorList = [];
	health.statuses = await Promise.allSettled(nodeURLs.map(url => axios.get(formURL(url, port, apiURLs.status))))
	.catch(err => {
		errorList.push('Ошибка обращения к АПИ статуса нод:' + err);
	});
	health.statuses.filter(el => el.status == 'rejected').forEach(el => errorList.push('Ошибка обращения к АПИ статуса ноды: ' + el.reason));
	health.statuses = health.statuses.filter(el => el.status == 'fulfilled').map(el => el.value);
	health.validators = await Promise.allSettled(nodeURLs.map(url => axios.get(formURL(url, port, apiURLs.validators))))
	.catch(err => {
		errorList.push('Ошибка обращения к АПИ валидаторов нод:' + err);
	});
	health.validators.filter(el => el.status == 'rejected').forEach(el => errorList.push('Ошибка обращения к АПИ валидатора ноды: ' + el.reason));
	health.validators = health.validators.filter(el => el.status == 'fulfilled').map(el => el.value);
	health.validatorsStatus = health.validators.map(el => el.data.result.map(e => e.pub_key)).reduce((res, validatorList, index) => {
		if (!isEqual(res, validatorList) && Array.isArray(res)) {
			res = index;
		}
		return res;
	}, health.validators.map(el => el.data.result.map(e => e.pub_key))[0] || []);
	if (!Array.isArray(health.validatorsStatus)) {
		errorList.push(`Различаются списки валидаторов на нодах ${nodeURLs[health.validatorsStatus-1]} и ${nodeURLs[health.validatorsStatus]}!!!`);
	}
	else {
		const nodeInfo = health.statuses.map(el => {
			return {
				pub_key: 'Kp' + CryptoJS.enc.Base64.parse(el.data.result.tm_status.validator_info.pub_key.value).toString(),
				height: el.data.result.latest_block_height,
				syncHeight: el.data.result.tm_status.sync_info.latest_block_height,
				url: el.config.url.substring(0, el.config.url.indexOf(':', 6))
			}
		});
		const notValidatingNodes = nodeInfo.filter(el => !health.validatorsStatus.find(e => e === el.pub_key));
		if (notValidatingNodes.length > 0) {
			const cand = await Promise.allSettled(notValidatingNodes.map(el => axios.get(formURL(el.url, port, apiURLs.candidate, el.pub_key))))
			.catch(err => {
				errorList.push('Ошибка обращения к АПИ кандидата нод: ' + err);
			});
			cand.filter(el => el.status == 'rejected').forEach(el => errorList.push('Ошибка обращения к АПИ кандидата ноды:' + el.reason));
			cand = cand.filter(el => el.status == 'fulfilled').map(el => el.value);
			cand.forEach(el => {
				if (el.data.result.status!=2) {
					errorList.push(`Валидатор на ноде ${el.config.url.substring(0, el.config.url.indexOf(':', 6))} упал!`);
				}
			});
		}
		const maxHeight = Math.max.apply(null, nodeInfo.map(el => el.height));
		nodeInfo
		.filter(el => el.syncHeight < maxHeight-1)
		.forEach(el => {
			errorList.push(`Нода ${el.url} не синхронизирована с остальной сетью!`);
		});
		if (showHealthObjectInfo) {
			logger.info(`Nodes status and health object requested manually.`);
			sendTelegram(`Мы получили запрос о детальном статусе нод. См. статус нод ${JSON.stringify(nodeInfo, null, 2)} и список валидаторов ${JSON.stringify(health.validatorsStatus, null, 2)}`);		
		}
	}
	if (forceShowInfo) {
		logger.info(`Nodes status requested manually.`);
		sendTelegram(`Мы получили запрос о статусе нод. Если есть какие-то ошибки- они пришли или вот-вот придут в ответ на этот запрос.`);	
	}
	errorList
	.filter(err => !prevErrorList.find(e => forceShowInfo || e == err))
	.forEach(err => {
		logger.error(`New error: ${err}`);
		sendTelegram(`Новая ошибка: ${err}`);
	});
	prevErrorList
	.filter(err => !errorList.find(e => forceShowInfo || e == err))
	.forEach(err => {
		logger.info(`Old error fixed: ${err}`);
		sendTelegram(`Старая ошибка исправлена: ${err}`);
	});
	prevErrorList = errorList;
	if (!forceShowInfo) {
		setTimeout(getHealthStatus, TEN_MINUTE, false);
	}
}

const getHealthStatusFunc = getHealthStatus;

module.exports = getHealthStatusFunc;