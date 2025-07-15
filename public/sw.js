self.addEventListener('push', function(event) {
  const data = event.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/globe.svg', // или ваш логотип
    data: data.url // опционально: открыть этот URL по клику
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data) {
    clients.openWindow(event.notification.data);
  }
}); 