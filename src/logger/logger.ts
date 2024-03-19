import chalk from 'chalk';
import dayjs from 'dayjs';

import LoggerService from './logger_service';

export class Logger {
	constructor(private readonly tag: string) {}

	private loggerService: LoggerService = LoggerService.getInstance();

	setLogFilePath(logFilePath: string) {
		this.loggerService.setLogFilePath(logFilePath);
	}

	fatal(message: string, ...args: unknown[]) {
		const heading = this.getHeading();
		const log = `${heading} ${message}`;

		this.loggerService.log(log, chalk.bgRed.white.bold, args);
	}

	trace(message: string, ...args: unknown[]) {
		const error = new Error(message);
		const log = `${error.stack}`;

		this.loggerService.log(log, chalk.white, args);
	}

	error(message: string, ...args: unknown[]) {
		const heading = this.getHeading();
		const log = `${heading} ${message}`;

		this.loggerService.log(log, chalk.red, args);
	}

	warning(message: string, ...args: unknown[]) {
		const heading = this.getHeading();
		const log = `${heading} ${message}`;

		this.loggerService.log(log, chalk.yellow, args);
	}

	info(message: string, ...args: unknown[]) {
		const heading = this.getHeading();
		const log = `${heading} ${message}`;

		this.loggerService.log(log, chalk.blue, args);
	}

	private getHeading() {
		const now = dayjs();
		const time = now.format('HH:mm:ss');
		const date = now.format('DD/MM/YYYY');

		return `${date} ${time} [${this.tag}]`;
	}
}
