import { Router } from "express";
import { check } from "express-validator";
import { createUser, assignPerson, getAssignments  } from "./user.controller.js";

const router = Router();

router.post(
  "/crear",
  [
    check("nombre", "El nombre es requerido").not().isEmpty(),
    check("familia", "La familia es requerida").not().isEmpty()
  ],
  createUser
);

router.post(
  "/asignar",
  [check("nombre", "El nombre es requerido").not().isEmpty()],
  assignPerson
);

router.get(
  "/resumen",
  getAssignments
);

export default router;