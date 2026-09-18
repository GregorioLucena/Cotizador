import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { entities } from './entities';

/** Railway y otros PaaS suelen exigir SSL; Postgres local no. */
export function postgresSslOption(): false | { rejectUnauthorized: false } {
  const flag = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (flag === 'false' || flag === '0') return false;
  if (flag === 'true' || flag === '1') return { rejectUnauthorized: false };

  const url = process.env.DATABASE_URL ?? '';
  if (/sslmode=require/i.test(url) || /railway|rlwy\.net/i.test(url)) {
    return { rejectUnauthorized: false };
  }
  return false;
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: postgresSslOption(),
  entities,
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});

let dataSource: DataSource | null = null;

export async function getDataSource(): Promise<DataSource> {
  if (dataSource?.isInitialized) {
    return dataSource;
  }

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  dataSource = AppDataSource;
  return dataSource;
}
