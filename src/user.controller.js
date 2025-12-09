import { validationResult } from "express-validator";
import userModel from "./user.model.js";

export const createUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, familia, pin } = req.body;

    const nombreLimpio = nombre.trim();
    const familiaLimpia = familia.trim();

    const pinGenerico =
      (pin && pin.toString().trim()) ||
      Math.floor(1000 + Math.random() * 9000).toString();

    const existe = await userModel.findOne({ nombre: nombreLimpio });
    if (existe) {
      return res.status(400).send("Ya existe una persona con ese nombre.");
    }

    const nuevaPersona = new userModel({
      nombre: nombreLimpio,
      familia: familiaLimpia,
      pin: pinGenerico
    });

    await nuevaPersona.save();

    return res.status(200).json({
      message: "Persona creada con éxito.",
      nombre: nuevaPersona.nombre,
      familia: nuevaPersona.familia,
      pin: nuevaPersona.pin
    });
  } catch (e) {
    console.log(e);
    return res.status(500).send("No se puede crear la persona.");
  }
};

export const assignPerson = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, pin } = req.body;
    const nombreLimpio = nombre.trim();
    const pinLimpio = pin.trim();

    const persona = await userModel.findOne({ nombre: nombreLimpio });

    if (!persona) {
      return res.status(404).send("No se encontró a la persona.");
    }

    if (persona.pin !== pinLimpio) {
      return res.status(401).send("PIN incorrecto.");
    }

    if (!persona.familia) {
      return res
        .status(400)
        .send(
          "Esta persona no tiene grupo familiar asignado. Contacta al organizador."
        );
    }

    if (persona.asignadoA) {
      const yaAsignado = await userModel.findById(persona.asignadoA);
      return res.json({
        message: "Ya tenías una persona asignada.",
        asignadoA: {
          nombre: yaAsignado?.nombre,
          familia: yaAsignado?.familia
        }
      });
    }

    const posibles = await userModel.find({
      _id: { $ne: persona._id },
      fueAsignado: false
    });

    const candidatos = posibles.filter(
      (c) => c.familia && c.familia !== persona.familia
    );

    if (!candidatos.length) {
      return res.status(400).json({
        message:
          "No hay personas disponibles que no sean de tu mismo grupo familiar."
      });
    }

    const indice = Math.floor(Math.random() * candidatos.length);
    const elegido = candidatos[indice];

    if (elegido.familia === persona.familia) {
      return res.status(500).send("Error en la validación de familias.");
    }

    persona.asignadoA = elegido._id;
    await persona.save();

    elegido.fueAsignado = true;
    await elegido.save();

    return res.json({
      message: "Persona asignada correctamente.",
      asignadoA: {
        nombre: elegido.nombre,
        familia: elegido.familia
      }
    });
  } catch (e) {
    console.log(e);
    return res.status(500).send("Error al asignar persona.");
  }
};

export const getAssignments = async (req, res) => {
  try {
    console.log("GET /intercambio/resumen");

    const users = await userModel
      .find()
      .populate("asignadoA", "nombre familia");

    const resultado = users.map((u) => ({
      nombre: u.nombre,
      familia: u.familia,
      pin: u.pin,
      asignadoA: u.asignadoA
        ? {
            nombre: u.asignadoA.nombre,
            familia: u.asignadoA.familia
          }
        : null
    }));

    return res.json(resultado);
  } catch (e) {
    console.log("Error en getAssignments:", e);
    return res.status(500).send("Error al obtener el resumen.");
  }
};