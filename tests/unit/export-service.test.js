import { buildBriefMarkdown, createMarkdownDownload } from "../../src/export-service.js";

describe("export service", () => {
  it("renders brief markdown with risks", () => {
    const md = buildBriefMarkdown({ cycleName: "Ciclo", behavior: "B", cause: "Ability", evidence: ["dato"], riskAccepted: true });
    expect(md).toContain("# Intervention Brief");
    expect(md).toContain("- dato");
    expect(md).toContain("Riesgo aceptado");
  });

  it("creates a markdown download", () => {
    const click = vi.fn();
    const documentRef = { createElement: () => ({ click }) };
    const urlRef = { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() };
    expect(createMarkdownDownload("# Brief", { documentRef, urlRef })).toMatchObject({ filename: "intervention-brief-dropi.md", url: "blob:test" });
    expect(click).toHaveBeenCalledOnce();
    expect(urlRef.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
