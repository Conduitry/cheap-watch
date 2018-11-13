import * as EventEmitter from 'events';
import * as fs from 'fs';

export default class CheapWatch extends EventEmitter {
	dir: string;
	filter?: Filter;
	watch: boolean;
	debounce: number;
	paths: Map<string, fs.Stats>;
	constructor(data: object);
	init(): Promise<void>;
	close(): void;
}

interface Filter {
	(file: { path: string; stats: fs.Stats }): Promise<boolean>;
}
