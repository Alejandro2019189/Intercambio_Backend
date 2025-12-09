// src/user.controller.js
import { validationResult } from "express-validator";
import userModel from "./user.model.js";

// CREAR PERSONA (nombre + familia)
export const createUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, familia } = req.body;

    const nombreLimpio = nombre.trim();
    const familiaLimpia = familia.trim();

    // evitar duplicados
    const existe = await userModel.findOne({ nombre: nombreLimpio });
    if (existe) {
      return res.status(400).send("Ya existe una persona con ese nombre.");
    }

    const nuevaPersona = new userModel({
      nombre: nombreLimpio,
      familia: familiaLimpia,
    });

    await nuevaPersona.save();

    return res.status(200).send("Persona creada con éxito.");
  } catch (e) {
    console.log(e);
    return res.status(500).send("No se puede crear la persona.");
  }
};

// ASIGNAR PERSONA (no de la misma familia)
export const assignPerson = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre } = req.body;

    const persona = await userModel.findOne({ nombre: nombre.trim() });

    if (!persona) {
      return res.status(404).send("No se encontró a la persona.");
    }

    if (!persona.familia) {
      return res
        .status(400)
        .send(
          "Esta persona no tiene grupo familiar asignado. Contacta al organizador."
        );
    }

    // si ya tenía asignación, devolver la misma
    if (persona.asignadoA) {
      const yaAsignado = await userModel.findById(persona.asignadoA);
      return res.json({
        message: "Ya tenías una persona asignada.",
        asignadoA: {
          nombre: yaAsignado?.nombre,
          familia: yaAsignado?.familia,
        },
      });
    }

    // candidatos base
    const posibles = await userModel.find({
      _id: { $ne: persona._id },
      fueAsignado: false,
    });

    // filtro por otra familia
    const candidatos = posibles.filter(
      (c) => c.familia && c.familia !== persona.familia
    );

    if (!candidatos.length) {
      return res.status(400).json({
        message:
          "No hay personas disponibles que no sean de tu mismo grupo familiar.",
      });
    }

    const indice = Math.floor(Math.random() * candidatos.length);
    const elegido = candidatos[indice];

    if (elegido.familia === persona.familia) {
      return res.status(500).send("Error en la validación de familias.");
    }

    // guardar asignación
    persona.asignadoA = elegido._id;
    await persona.save();

    elegido.fueAsignado = true;
    await elegido.save();

    return res.json({
      message: "Persona asignada correctamente.",
      asignadoA: {
        nombre: elegido.nombre,
        familia: elegido.familia,
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(500).send("Error al asignar persona.");
  }
};

export const getAssignments = async (req, res) => {
  try {
    console.log("GET /intercambio/resumen");

    // Traemos todos los usuarios y populamos la persona asignada
    const users = await userModel
      .find()
      .populate("asignadoA", "nombre familia");

    const resultado = users.map((u) => ({
      nombre: u.nombre,
      familia: u.familia,
      asignadoA: u.asignadoA
        ? {
            nombre: u.asignadoA.nombre,
            familia: u.asignadoA.familia,
          }
        : null,
    }));

    return res.json(resultado);
  } catch (e) {
    console.log("Error en getAssignments:", e);
    return res.status(500).send("Error al obtener el resumen.");
  }
};