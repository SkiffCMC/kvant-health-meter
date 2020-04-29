const {createLogger, format, transports, config} = require('winston');
const {Mail} = require('winston-mail');
const appConfig = require('config');
const moment = require('moment');

const loggers = appConfig.get('loggers');

const transportMapping = {
	console: options => new transports.Console(options),
	file: options => new transports.File(options),
	mail:  options => new Mail(options)
};

const tsFormat = () => moment().format('YYYY-MM-DD HH:mm:ss.SSS');

const logConfig = {
	levels: config.syslog.levels,
	exitOnError: true,
	format: format.combine(
		format.timestamp({format: tsFormat}),
		format.prettyPrint(),
	),
	transports: Object.keys(loggers).map(key => transportMapping[key](loggers[key]))
};

const logger = createLogger(logConfig);

module.exports = logger;