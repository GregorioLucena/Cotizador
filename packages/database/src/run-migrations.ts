import { AppDataSource } from './data-source';

async function runMigrations() {
  await AppDataSource.initialize();
  const executed = await AppDataSource.runMigrations();
  console.log(
    executed.length === 0
      ? 'Migraciones: no habia pendientes.'
      : `Migraciones aplicadas: ${executed.map((item) => item.name).join(', ')}`,
  );
  await AppDataSource.destroy();
}

runMigrations().catch((error) => {
  console.error('Error ejecutando migraciones', error);
  process.exit(1);
});
