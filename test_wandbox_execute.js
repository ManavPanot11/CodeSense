async function test() {
  try {
    const res = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compiler: "gcc-13.2.0",
        code: "#include <iostream>\nint main() { std::cout << \"Hello from Wandbox!\"; return 0; }",
        stdin: "",
      })
    });
    const json = await res.json();
    console.log(json);
  } catch (err) {
    console.error(err);
  }
}
test();
