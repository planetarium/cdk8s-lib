import { Testing } from 'cdk8s';
import { Headless, PrivateKeyStrategy } from './headless';

describe(Headless.name, () => {
    test('snapshot', () => {
        const chart = Testing.chart();
        new Headless(chart, "main-miner-1", {
            appProtocolVersion: "100080/6ec8E598962F1f475504F82fD5bF3410eAE58B9B/MEUCIQCrSQ9v7NZBo5yCyvlHgBXW6lD4p2lFlKqK+aMeoKA.IAIgVkcK6hMCw1E0mf+m7rCf+9XnSL8Apg.joe6I1a8Nw70=/ZHUxNjpXaW5kb3dzQmluYXJ5VXJsdTU2Omh0dHBzOi8vZG93bmxvYWQubmluZS1jaHJvbmljbGVzLmNvbS92MTAwMDgwL1dpbmRvd3MuemlwdTk6dGltZXN0YW1wdTEwOjIwMjEtMDktMzBl",
            trustedAppProtocolVersionSigner: "03eeedcd574708681afb3f02fb2aef7c643583089267d17af35e978ecaf2a1184e",
            genesisBlockPath: "https://9c-test.s3.ap-northeast-2.amazonaws.com/genesis-block-9c-main",
            libplanet: {
              host: "9c-main-miner-1.planetarium.dev",
              port: 31234,
              open: true,
            },
            store: {
              path: "/data/miner",
              type: "rocksdb",
            },
            swarmPrivateKey: {
              strategy: PrivateKeyStrategy.FromSecret,
              secret: {
                key: "miner-keys",
                name: "miner1",
              },
            },
            minerPrivateKey: {
              strategy: PrivateKeyStrategy.FromSecret,
              secret: {
                key: "miner-keys",
                name: "miner1",
              },
            },
            graphql: {
              host: "0.0.0.0",
              port: 80,
              open: true,
            },
            minimumBroadcastTarget: 50,
            txQuotaPerSigner: 500,
            image: "planetariumhq/ninechronicles-headless:v100080-mt-2021093001",
            replicas: 1,
            peers: [
              "027bd36895d68681290e570692ad3736750ceaab37be402442ffb203967f98f7b6,9c-main-seed-1.planetarium.dev,31234",
              "02f164e3139e53eef2c17e52d99d343b8cbdb09eeed88af46c352b1c8be6329d71,9c-main-seed-2.planetarium.dev,31234",
              "0247e289aa332260b99dfd50e578f779df9e6702d67e50848bb68f3e0737d9b9a5,9c-main-seed-3.planetarium.dev,31234",
            ],
          })
        const results = Testing.synth(chart)
        expect(results).toMatchSnapshot();
    });
});
