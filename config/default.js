/*const SMTPServer = require("smtp-server").SMTPServer;

function createSMTPServer() {
	const server = new SMTPServer({
		onData(stream, session, callback) {
			stream.pipe(process.stdout); // print message to console
			stream.on("end", callback);
		},
		onConnect(session, callback) {
			console.log(session);
			return callback();
		}
	});
	server.listen(25);
	server.on('error', err => {
		console.log('SMTP error = ', err);
	});
	//console.log('server = ', server);
	return 'localhost';
}*/

module.exports = {
	loggers: {
		file: {
			level: 'info',
			filename: './logs/api.log',
			handleExceptions: true,
			json: true,
			maxsize: 10485760, // 10MB
			colorize: false,
		}
		/*mail: {
			level: 'crit',
			handleExceptions: true,
			//host: 'localhost',
			//port: 25,
			to: 'skiffcmc@gmail.com',
			from: 'kvanthealthmeter@monitors.com',
			subject: 'Критичная ошибка'		
		}*/
	}
}