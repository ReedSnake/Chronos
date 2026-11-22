const MAX_CONCURRENT_DELIVERIES = 2;

const pendingDeliveries = [];
let activeDeliveries = 0;

function processDeliveries() {
  while (activeDeliveries < MAX_CONCURRENT_DELIVERIES && pendingDeliveries.length) {
    const next = pendingDeliveries.shift();
    activeDeliveries += 1;
    Promise.resolve()
      .then(next.deliver)
      .then(next.resolve, next.reject)
      .finally(() => {
        activeDeliveries -= 1;
        processDeliveries();
      });
  }
}

function enqueueEmailDelivery(deliver) {
  return new Promise((resolve, reject) => {
    pendingDeliveries.push({ deliver, resolve, reject });
    processDeliveries();
  });
}

module.exports = { enqueueEmailDelivery };
