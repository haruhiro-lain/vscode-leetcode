const axios = require('axios');

async function main() {
    let input = '';
    for await (const chunk of process.stdin) {
        input += chunk;
        if (input.length > 65536) throw Error('Invalid input');
    }
    const options = JSON.parse(input);
    const url = new URL(options.url);
    if (url.protocol !== 'https:' || url.hostname !== 'leetcode.cn' || url.port && url.port !== '443' || url.username || url.password) {
        throw Error('Invalid direct request target');
    }
    const result = await axios(url.href, {
        method: options.method || 'POST', headers: options.headers, data: options.data,
        proxy: false, timeout: 15000, maxRedirects: 0, maxContentLength: 1024 * 1024,
        validateStatus: () => true,
    });
    process.stdout.write(JSON.stringify({ status: result.status, data: result.data }));
}
main().catch(() => {
    // Never serialize Axios errors: they contain the credential headers.
    process.stdout.write(JSON.stringify({ error: 'Direct request failed' }));
});
