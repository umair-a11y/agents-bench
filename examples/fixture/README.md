# Fixture repo

Throwaway target repo for the `agents-bench` mock demo. The mock backend writes
its verdict to `.agents-bench-mock-result`, which the example checks read.

You can run the demo from the project root:

    bun run src/cli.ts --agent mock --config examples/bench.yaml --repo examples/fixture
