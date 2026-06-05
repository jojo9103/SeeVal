import assert from "node:assert/strict";

import {
  type ProjectColumnMetadataInput,
  validateRowsWithColumnMetadata,
} from "@/lib/project-column-metadata";

function column(
  overrides: Partial<ProjectColumnMetadataInput>
): ProjectColumnMetadataInput {
  return {
    name: "value",
    dataType: "int",
    minValue: null,
    maxValue: null,
    nullable: true,
    unit: null,
    description: null,
    ...overrides,
  };
}

function errorsFor(
  value: string,
  metadata: ProjectColumnMetadataInput
) {
  return validateRowsWithColumnMetadata({
    rows: [{ [metadata.name]: value }],
    metadata: [metadata],
  });
}

assert.equal(errorsFor("1.5", column({ dataType: "int" })).length, 1);
assert.equal(errorsFor("1.0", column({ dataType: "int" })).length, 0);
assert.equal(errorsFor("abc", column({ dataType: "int" })).length, 1);
assert.equal(errorsFor("abc", column({ dataType: "float" })).length, 1);
assert.equal(
  errorsFor("-1", column({ dataType: "int", minValue: 0 })).length,
  1
);
assert.equal(
  errorsFor("121", column({ dataType: "int", maxValue: 120 })).length,
  1
);
assert.equal(
  errorsFor("", column({ dataType: "string", nullable: false })).length,
  1
);
assert.equal(
  errorsFor(
    "50",
    column({ dataType: "float", minValue: 0, maxValue: 100 })
  ).length,
  0
);
assert.equal(
  errorsFor("999", column({ dataType: "float", minValue: null, maxValue: null }))
    .length,
  0
);

console.log("project-column-validation tests passed");
