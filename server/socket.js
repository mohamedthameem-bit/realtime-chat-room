let ioInstance = null;

module.exports = {
  setIo: (io) => {
    ioInstance = io;
  },
  getIo: () => ioInstance,
  emitNotification: (userId, notification) => {
    if (ioInstance) {
      ioInstance.to(userId.toString()).emit('new_notification', notification);
    }
  }
};
