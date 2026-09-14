let bundleError = null;
let bundle = null;
try {
  bundle = require('./bundle.js');
} catch (e) {
  bundleError = { message: e.message, stack: e.stack, name: e.name };
}

exports.main = async (event, context) => {
  if (bundleError) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'BUNDLE_LOAD_FAILED', bundleError }),
    };
  }

  try {
    const res = await bundle.main(event, context);
    return res;
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'BUNDLE_INVOKE_FAILED', message: err.message, stack: err.stack }),
    };
  }
};
