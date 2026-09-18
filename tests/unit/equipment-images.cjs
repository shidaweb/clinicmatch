/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS regression runner. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/lib/equipment-images.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: exportsObject }
);
const { findEquipmentImage: find, equipmentImages, equipmentImageUrl } = exportsObject;
assert.equal(find('キャンデラ株式会社', 'Gentle Max Pro')?.key, 'gentlemax-pro');
assert.equal(find('CANDELA', 'ＧｅｎｔｌｅＭａｘ Ｐｒｏ')?.key, 'gentlemax-pro');
assert.equal(find('Candela', 'GentleMax Pro Plus'), null);
assert.equal(find('Lumenis', 'GentleMax Pro'), null);
assert.equal(find('Candela', 'GentleMax Pro', 'consumable'), null);
assert.equal(find(null, 'GentleMax Pro'), null);
assert.equal(find('Asclepion', 'メディオスターモノリス')?.key, 'mediostar-monolith');
assert.equal(find('Asclepion', 'メディオスターNeXT PRO'), null);
assert.equal(find('CUTERA', 'xeo')?.key, 'xeo');
assert.equal(find('CUTERA', 'enlighten'), null);
assert.equal(find('ジェイメック', 'ウルセラ')?.key, 'ulthera');
assert.equal(find('シネロン・キャンデラ', 'ピコウェイ')?.key, 'picoway');
for (const item of equipmentImages)
  for (const width of [480, 960]) assert.ok(fs.existsSync('public' + equipmentImageUrl(item, width)));
console.log(
  'PASS: model/maker matching, variant and consumable exclusions, normalized labels, all image assets exist.'
);

const categoriesModule = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/lib/categories.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: categoriesModule.exports }
);
const categoryModule = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/lib/category-images.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  {
    exports: categoryModule.exports,
    require: (name) => {
      assert.equal(name, './categories');
      return categoriesModule.exports;
    },
  }
);
const { categoryImageUrl, categoryImageCaption } = categoryModule.exports;
for (const slug of categoriesModule.exports.CATEGORY_SLUGS) {
  for (const width of [480, 960]) {
    assert.equal(categoryImageUrl(slug, 'device', width), `/images/categories/${slug}-${width}.webp`);
    assert.ok(fs.existsSync('public' + categoryImageUrl(slug, 'device', width)));
    assert.ok(fs.existsSync('public' + categoryImageUrl(slug, 'consumable', width)));
  }
}
assert.equal(categoryImageUrl('unknown'), categoryImageUrl('others'));
assert.equal(categoryImageUrl(null), categoryImageUrl('others'));
assert.equal(categoryImageUrl('../private'), categoryImageUrl('others'));
assert.equal(categoryImageCaption, '（写真はイメージです）');
console.log('PASS: all category fallbacks and consumables resolve to existing assets; unknown categories are safe.');
