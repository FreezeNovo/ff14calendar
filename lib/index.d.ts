import { Context, Schema } from 'koishi';
export interface Config {
    webcalUrl: string;
    targetId: string;
    cronTime: string;
    messageTemplate: string;
    proxy?: string;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
