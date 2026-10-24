import mongoose from 'mongoose';

export const connectDatabase = (uri) => mongoose.connect(uri, {
  autoIndex: process.env.NODE_ENV !== 'production'
});

export const disconnectDatabase = () => mongoose.disconnect();
