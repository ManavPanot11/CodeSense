async function test() {
  try {
    const res = await fetch("https://wandbox.org/api/list.json");
    const json = await res.json();
    const map = {};
    for (const c of json) {
      if (!map[c.language]) {
        map[c.language] = c.name;
      }
    }
    console.log(map);
  } catch (err) {
    console.error(err);
  }
}
test();
