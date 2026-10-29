const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

test('study plan refresh invalidates editor descriptions and listeners are disposed with the controller', () => {
    let planListener, configListener, disposed = 0, refreshed = 0, registered;
    const subscription = () => ({ dispose() { disposed++; } });
    const provider = { refresh() { refreshed++; } };
    const mocks = {
        vscode: {
            workspace: { onDidChangeConfiguration(fn) { configListener = fn; return subscription(); } },
            languages: { registerCodeLensProvider(selector, value) { registered = { selector, value }; return subscription(); } },
        },
        './CustomCodeLensProvider': { customCodeLensProvider: provider },
        '../studyPlans/studyPlanManager': { studyPlanManager: { onDidChange(fn) { planListener = fn; return subscription(); } } },
    };
    const originalLoad = Module._load;
    Module._load = function(name, parent, isMain) { return mocks[name] || originalLoad.call(this, name, parent, isMain); };
    let controller;
    try { ({ codeLensController: controller } = require('../out/src/codelens/CodeLensController')); }
    finally { Module._load = originalLoad; }
    assert.deepEqual(registered.selector, { scheme: 'file' }); assert.equal(registered.value, provider);
    planListener(); assert.equal(refreshed, 1);
    configListener({ affectsConfiguration: () => true }); assert.equal(refreshed, 2);
    controller.dispose(); assert.equal(disposed, 3);
});
