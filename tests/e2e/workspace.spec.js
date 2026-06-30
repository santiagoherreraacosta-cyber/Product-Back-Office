import { expect, test } from "@playwright/test";

test("core cycle flow exports the brief", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download");
  await page.goto("/");

  await page.getByRole("button", { name: "Ciclos" }).click();
  await expect(page.getByRole("heading", { name: "Ciclos" })).toBeVisible();

  await page.getByRole("button", { name: "Nuevo ciclo" }).click();
  await expect(page.getByText("F0 · Sense")).toBeVisible();

  await page.getByLabel("Mensaje").fill("Tengo evidencia F0 sobre el comportamiento objetivo");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Lo tomo como nueva evidencia conversacional")).toBeVisible();

  await page.getByRole("button", { name: "F1 Diagnose falta 2ª fuente" }).click();
  await expect(page.getByText("F1 · Diagnose")).toBeVisible();

  await page.getByRole("button", { name: "Avanzar igual" }).click();
  await expect(page.getByText("F2 · Design")).toBeVisible();
  await expect(page.getByText("riesgo aceptado")).toBeVisible();

  await page.getByRole("button", { name: "Experiment Card" }).click();
  await expect(page.getByText("Borrador · listo para F3")).toBeVisible();

  await page.getByRole("button", { name: "↧ Exportar brief" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("intervention-brief-dropi.md");
});
