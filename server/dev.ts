process.env.NODE_ENV = 'development';
process.env.PORT ||= '4319';
process.env.RAMUNE_DATA_DIR ||= '.ramune/development';
await import('./index.js');
export {};
