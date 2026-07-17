import type { GenerateInput, StructuredModel } from "../../src/llm/structured-model.js";

export class FakeStructuredModel implements StructuredModel {
  callCount = 0;
  response: unknown = { findings: [] };

  async generate<T>(input: GenerateInput<T>): Promise<T> {
    this.callCount += 1;
    const parsed = input.schema.safeParse(this.response);
    if (!parsed.success) throw new Error(`FakeStructuredModel misconfigured: ${parsed.error.message}`);
    return parsed.data;
  }
}
