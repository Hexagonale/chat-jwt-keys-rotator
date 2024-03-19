import fs from 'fs';
import fsPromises from 'fs/promises';
import dayjs from 'dayjs';
import path from 'path';

export default class LoggerService {
	private constructor() {}

	private static instance: LoggerService | null;

	static getInstance() {
		if (LoggerService.instance == null) {
			LoggerService.instance = new LoggerService();
		}

		return LoggerService.instance!;
	}

	private readonly maxFileSize = 1024 * 1024;
	private logFilePath: string | null = null;

	setLogFilePath(logFilePath: string) {
		this.logFilePath = logFilePath;
	}

	log(message: string, format: (message: string) => string, args: unknown[]) {
		const formattedMessage = format(message);

		// eslint-disable-next-line no-console
		console.log(formattedMessage, ...args);

		if (this.logFilePath != null) {
			const stringifiedArgs = args.length === 0 ? '' : JSON.stringify(args);
			const messageForFile = `${message}\n${stringifiedArgs}`;

			this.writeToFile(messageForFile, this.logFilePath);
		}
	}

	private async writeToFile(message: string, logFilePath: string): Promise<void> {
		const dirname = path.dirname(logFilePath);
		if (!fs.existsSync(dirname)) {
			await fsPromises.mkdir(dirname, { recursive: true });
		}

		if (fs.existsSync(logFilePath)) {
			const stats = await fsPromises.stat(logFilePath);
			if (stats.size > this.maxFileSize) {
				await this.rotateLog(logFilePath);
			}
		}

		await fsPromises.appendFile(logFilePath, `${message}\n`);
	}

	private async rotateLog(logFilePath: string): Promise<void> {
		const extension = path.extname(logFilePath);
		const basename = path.basename(logFilePath);
		const filename = basename.replace(extension, '');
		const timestamp = dayjs().unix();
		const destination = logFilePath.replace(basename, `${filename}.${timestamp}.${extension}`);

		await fsPromises.rename(logFilePath, destination);
	}
}
