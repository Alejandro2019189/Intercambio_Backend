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
      pin: pinGenerico,
    });

    await nuevaPersona.save();

    return res.status(200).json({
      message: "Persona creada con éxito.",
      nombre: nuevaPersona.nombre,
      familia: nuevaPersona.familia,
      pin: nuevaPersona.pin,
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

    if (!persona.asignadoA) {
      return res
        .status(400)
        .send("Aún no se ha generado el intercambio. Contacta al organizador.");
    }

    const personaConAsignado = await persona.populate(
      "asignadoA",
      "nombre familia"
    );

    return res.json({
      message: "Persona asignada para ti.",
      asignadoA: {
        nombre: personaConAsignado.asignadoA.nombre,
        familia: personaConAsignado.asignadoA.familia,
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(500).send("Error al obtener tu persona asignada.");
  }
};

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export const generateGlobalAssignments = async (req, res) => {
  try {
    await userModel.updateMany({}, { asignadoA: null, fueAsignado: false });

    const users = await userModel.find();

    if (users.length < 2) {
      return res.status(400).json({
        message: "Se necesitan al menos 2 personas para generar el intercambio.",
      });
    }

    shuffle(users);

    const n = users.length;
    const usedRecipients = new Set(); 
    const assignmentMap = new Map(); 

    const backtrack = (index) => {
      if (index === n) return true;

      const giver = users[index];
      const giverId = giver._id.toString();

      const indices = [...Array(n).keys()];
      shuffle(indices);

      for (let idx of indices) {
        const candidate = users[idx];
        const candidateId = candidate._id.toString();

        if (candidateId === giverId) continue;

        if (candidate.familia === giver.familia) continue;

        if (usedRecipients.has(candidateId)) continue;

        usedRecipients.add(candidateId);
        assignmentMap.set(giverId, candidate);

        const success = backtrack(index + 1);
        if (success) return true;

        usedRecipients.delete(candidateId);
        assignmentMap.delete(giverId);
      }

      return false;
    };

    const success = backtrack(0);

    if (!success) {
      return res.status(400).json({
        message:
          "No se pudo generar una asignación válida. Revisa la distribución de familias (puede que sea imposible que todos den a otra familia).",
      });
    }

    const savePromises = users.map((u) => {
      const giverId = u._id.toString();
      const recipient = assignmentMap.get(giverId);
      if (!recipient) return Promise.resolve();

      u.asignadoA = recipient._id;
      u.fueAsignado = true;
      return u.save();
    });

    await Promise.all(savePromises);

    return res.json({
      message: "Intercambio generado correctamente.",
      totalPersonas: users.length,
    });
  } catch (e) {
    console.log("Error al generar intercambio global:", e);
    return res
      .status(500)
      .send("Error al generar el intercambio. Intenta de nuevo.");
  }
};

export const getAssignments = async (req, res) => {
  try {
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