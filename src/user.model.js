import mongoose from "mongoose";

const userIntercambioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  familia: {
    type: String,
    required: true,
    trim: true
  },
  pin: {
    type: String,
    required: true
  },
  asignadoA: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "userIntercambio",
    default: null
  },
  fueAsignado: {
    type: Boolean,
    default: false
  }
});

export default mongoose.model("userIntercambio", userIntercambioSchema);