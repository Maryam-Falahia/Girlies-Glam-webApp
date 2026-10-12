import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import productsRouter from "./products";
import wishlistRouter from "./wishlist";
import ordersRouter from "./orders";
import checkoutRouter from "./checkout";
import settingsRouter from "./settings";
import discountsRouter from "./discounts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(productsRouter);
router.use(wishlistRouter);
router.use(ordersRouter);
router.use(checkoutRouter);
router.use(settingsRouter);
router.use(discountsRouter);

export default router;
