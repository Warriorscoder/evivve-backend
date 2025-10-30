import pkg from 'express';
const { Router} = pkg;

const router = Router();

router.get("/", (_req, res) => {
  res.status(200).json({ status: "ok", message: "Evivve backend running 🚀" });
});

export default router;
