import mongoose from "mongoose";

const presenceSchema = new mongoose.Schema({
  userId: String,
  status: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const PresenceLog = mongoose.model("PresenceLog", presenceSchema);

export default PresenceLog;
