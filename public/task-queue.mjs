export function serialQueue(){let tail=Promise.resolve();return task=>{const next=tail.then(task);tail=next.catch(()=>{});return next;};}
