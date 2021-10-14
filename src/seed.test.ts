import { Seed } from './seed';
import { Testing } from 'cdk8s';

describe(Seed.name, () => {
    test('snapshot', () => {
        const chart = Testing.chart();
        new Seed(chart, 'main-seed-1', {
            image: "planetariumhq/libplanet-seed:git-08e65a8b4a88b9c53266a92df573641a7b6e50f0",
            appProtocolVersion: "100080/6ec8E598962F1f475504F82fD5bF3410eAE58B9B/MEUCIQCrSQ9v7NZBo5yCyvlHgBXW6lD4p2lFlKqK+aMeoKA.IAIgVkcK6hMCw1E0mf+m7rCf+9XnSL8Apg.joe6I1a8Nw70=/ZHUxNjpXaW5kb3dzQmluYXJ5VXJsdTU2Omh0dHBzOi8vZG93bmxvYWQubmluZS1jaHJvbmljbGVzLmNvbS92MTAwMDgwL1dpbmRvd3MuemlwdTk6dGltZXN0YW1wdTEwOjIwMjEtMDktMzBl",
            graphql: {
                host: "0.0.0.0",
                port: 31237,
            },
            libplanet: {
                host: "9c-main-seed-1.planetarium.dev",
                port: 31234,
            },
            logLevel: "debug",
            // Created from `planet key generate`.
            privateKey: "09aa7ce7bbd71d50bcf34e089545f1875bbfbc7bea56a24467bc9e7e79228d3e",
            workers: 500,
        });
        const results = Testing.synth(chart)
        expect(results).toMatchSnapshot();
    });
});
