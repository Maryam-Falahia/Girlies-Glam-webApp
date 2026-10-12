import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: undefined as undefined | { id: number; isAdmin: boolean },
  settings: {
    id: 1,
    notifyEmail: "alerts@example.com",
    notifyPhone: "+96879162199",
    transferDetails: "Bank: Test Bank\nAccount: 123",
    emailFailureAt: null as Date | null,
    whatsappFailureAt: null as Date | null,
  },
  sendNotificationTest: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(async () => (mocks.user ? [mocks.user] : [])),
      then: (resolve: (value: unknown) => void) => resolve([mocks.settings]),
    })),
  }));
  const insert = vi.fn(() => ({
    values: vi.fn(() => ({ returning: vi.fn(async () => [mocks.settings]) })),
  }));
  const update = vi.fn(() => ({
    set: vi.fn((values: typeof mocks.settings) => ({
      returning: vi.fn(async () => [{ ...mocks.settings, ...values }]),
    })),
  }));
  return {
    db: { select, insert, update },
    notificationSettingsTable: {},
    usersTable: { id: {} },
  };
});
vi.mock("../lib/notify", () => ({
  sendNotificationTest: mocks.sendNotificationTest,
}));

import settingsRouter from "./settings";

function appWithUser(userId?: number) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.signedCookies = userId ? { gg_session: String(userId) } : {};
    next();
  });
  app.use(settingsRouter);
  return app;
}

describe("notification settings routes", () => {
  beforeEach(() => {
    mocks.user = undefined;
    mocks.settings.transferDetails = "Bank: Test Bank\nAccount: 123";
    mocks.sendNotificationTest.mockReset().mockResolvedValue({ channel: "email", recipient: "alerts@example.com" });
  });

  it("rejects unauthenticated users from loading and saving settings", async () => {
    await request(appWithUser()).get("/admin/settings").expect(401);
    await request(appWithUser())
      .patch("/admin/settings")
      .send({ notifyEmail: "new@example.com", notifyPhone: "+96879162199" })
      .expect(401);
  });

  it("rejects authenticated non-admin users from loading and saving settings", async () => {
    mocks.user = { id: 2, isAdmin: false };
    await request(appWithUser(2)).get("/admin/settings").expect(403);
    await request(appWithUser(2))
      .patch("/admin/settings")
      .send({ notifyEmail: "new@example.com", notifyPhone: "+96879162199" })
      .expect(403);
  });

  it("allows admins to load and save settings", async () => {
    mocks.user = { id: 1, isAdmin: true };
    await request(appWithUser(1))
      .get("/admin/settings")
      .expect(200, {
        notifyEmail: "alerts@example.com",
        notifyPhone: "+96879162199",
        transferDetails: "Bank: Test Bank\nAccount: 123",
        deliveryHealth: { emailFailedAt: null, whatsappFailedAt: null },
      });

    const response = await request(appWithUser(1))
      .patch("/admin/settings")
       .send({ notifyEmail: "new@example.com", notifyPhone: "+96890000000", transferDetails: "" })
      .expect(200);
    expect(response.body).toEqual({
      notifyEmail: "new@example.com",
      notifyPhone: "+96890000000",
      transferDetails: "",
      deliveryHealth: { emailFailedAt: null, whatsappFailedAt: null },
    });
  });

  it("lets anyone load the current transfer instructions for checkout", async () => {
    await request(appWithUser()).get("/settings/payment").expect(200, {
      transferDetails: "Bank: Test Bank\nAccount: 123",
    });
  });

  it("shows the latest delivery failure timestamps to admins", async () => {
    mocks.user = { id: 1, isAdmin: true };
    mocks.settings.emailFailureAt = new Date("2026-09-17T10:15:00Z");
    mocks.settings.whatsappFailureAt = new Date("2026-09-17T10:20:00Z");

    await request(appWithUser(1)).get("/admin/settings").expect(200, {
      notifyEmail: "alerts@example.com",
      notifyPhone: "+96879162199",
      transferDetails: "Bank: Test Bank\nAccount: 123",
      deliveryHealth: {
        emailFailedAt: "2026-09-17T10:15:00.000Z",
        whatsappFailedAt: "2026-09-17T10:20:00.000Z",
      },
    });

    mocks.settings.emailFailureAt = null;
    mocks.settings.whatsappFailureAt = null;
  });

  it.each([
     [{ notifyEmail: "not-an-email", notifyPhone: "+96879162199", transferDetails: "" }, "email"],
     [{ notifyEmail: "valid@example.com", notifyPhone: "79162199", transferDetails: "" }, "phone"],
  ])("rejects invalid notification contacts", async (body, field) => {
    mocks.user = { id: 1, isAdmin: true };
    const response = await request(appWithUser(1)).patch("/admin/settings").send(body).expect(400);
    expect(response.body.error).toMatch(new RegExp(field, "i"));
  });

  it("lets admins test either configured alert channel", async () => {
    mocks.user = { id: 1, isAdmin: true };

    await request(appWithUser(1))
      .post("/admin/settings/notifications/test")
      .send({ channel: "email", recipient: "test@example.com" })
      .expect(200, { ok: true, channel: "email", recipient: "alerts@example.com" });
    await request(appWithUser(1))
      .post("/admin/settings/notifications/test")
      .send({ channel: "whatsapp", recipient: "+96890000000" })
      .expect(200);

    expect(mocks.sendNotificationTest).toHaveBeenNthCalledWith(1, "email", "test@example.com");
    expect(mocks.sendNotificationTest).toHaveBeenNthCalledWith(2, "whatsapp", "+96890000000");
  });

  it("rejects unknown notification test channels", async () => {
    mocks.user = { id: 1, isAdmin: true };
    await request(appWithUser(1))
      .post("/admin/settings/notifications/test")
      .send({ channel: "sms" })
      .expect(400);
    expect(mocks.sendNotificationTest).not.toHaveBeenCalled();
  });
});