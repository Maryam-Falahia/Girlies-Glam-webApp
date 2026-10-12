import { db, productsTable, usersTable, notificationSettingsTable, shippingSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./lib/auth";
import { PRODUCTS } from "../../girlies-glam/src/lib/data";

async function seed() {
  const email = "demo@girliesglam.com";
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!existing) {
    await db.insert(usersTable).values({
      name: "Maryam Al-Falahi",
      email,
      passwordHash: hashPassword("glam123"),
      initials: "MF",
      isAdmin: true,
    });
    console.log("Created admin user", email);
  } else if (!existing.isAdmin) {
    await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.id, existing.id));
    console.log("Promoted existing user to admin", email);
  } else {
    console.log("Admin user already present", email);
  }

  const catalog = PRODUCTS.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    compareAt: product.compareAt ?? null,
    colorway: product.colorway,
    swatch: product.swatch,
    sizes: product.sizes,
    isNew: Boolean(product.isNew),
    isBestseller: Boolean(product.isBestseller),
    isVisible: true,
    rating: product.rating,
    reviews: product.reviews,
    description: product.description,
  }));

  if (catalog.length) {
    await db.insert(productsTable).values(catalog).onConflictDoNothing();
    console.log(`Ensured ${catalog.length} catalog products`);
  }

  const [notify] = await db.select().from(notificationSettingsTable).limit(1);
  if (!notify) {
    await db.insert(notificationSettingsTable).values({ id: 1 });
    console.log("Created notification settings");
  }

  const [shipping] = await db.select().from(shippingSettingsTable).limit(1);
  if (!shipping) {
    await db.insert(shippingSettingsTable).values({ id: 1 });
    console.log("Created shipping settings");
  }
}

seed()
  .then(() => {
    console.log("Seed complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
