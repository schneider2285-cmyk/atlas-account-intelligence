import { runDailyCycle } from '@/services/scheduler/cronRunner';

runDailyCycle()
  .then((results) => {
    console.log(JSON.stringify(results, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
