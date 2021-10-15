import { Construct } from "constructs";
import { KubeService, IntOrString, Quantity, EnvVar } from "cdk8s-plus-22/lib/imports/k8s";
import { KubeStatefulSet } from "../imports/k8s";

interface HostAndPort { host: string, port: number | undefined };

export enum PrivateKeyStrategy {
    FromSecret,
    FromValue,
}

type PrivateKey = {
    strategy: PrivateKeyStrategy.FromSecret,
    secret: {
        name: string,
        key: string,
    }
} | {
    strategy: PrivateKeyStrategy.FromValue,
    privateKey: string,
};

export interface HeadlessOptions {
    replicas: number,
    image: string,
    workers?: number,
    appProtocolVersion: string,
    trustedAppProtocolVersionSigner: string,
    genesisBlockPath: string,
    txQuotaPerSigner: number,
    libplanet: HostAndPort | undefined,
    graphql: HostAndPort | undefined,
    iceServers?: string[],
    peers: string[] | undefined,
    swarmPrivateKey: PrivateKey | undefined,
    minerPrivateKey: PrivateKey | undefined,
    store: {
        type: string,
        path: string,
    },
    chainTipStaleBehaviour?: string,
    minimumBroadcastTarget: number,
};

export class Headless extends Construct {
    constructor(scope: Construct, id: string, options: HeadlessOptions) {
        super(scope, id);

        const VOLUME_NAME = `${id}-data`;

        const iceServers = options.iceServers || [];
        const iceServersArgs = iceServers.flatMap(iceServer => ["--ice-server", iceServer]);

        const peers = options.peers || [];
        const peersArgs = peers.map(peer => `--peer=${peer}`);

        const libplanetArgs = options.libplanet === undefined
            ? []
            : [
                `--host=${options.libplanet.host}`,
                `--port=${options.libplanet.port}`
            ];

        const graphqlArgs = options.graphql === undefined
            ? []
            : [
                `--graphql-server`,
                `--graphql-host=${options.graphql.host}`,
                `--graphql-port=${options.graphql.port}`
            ];

        const privateKeyArgs = [];
        const envArgs: EnvVar[] = [];
        if (options.swarmPrivateKey !== undefined) {
            if (options.swarmPrivateKey.strategy === PrivateKeyStrategy.FromValue) {
                privateKeyArgs.push(`--swarm-private-key=${options.swarmPrivateKey.privateKey}`);
            } else if (options.swarmPrivateKey.strategy === PrivateKeyStrategy.FromSecret) {
                privateKeyArgs.push(`--swarm-private-key=$(SWARM_PRIVATE_KEY)`);
                envArgs.push({
                    name: "SWARM_PRIVATE_KEY",
                    valueFrom: {
                        secretKeyRef: {
                            key: options.swarmPrivateKey.secret.key,
                            name: options.swarmPrivateKey.secret.name,
                        }
                    }
                });
            }
        }

        if (options.minerPrivateKey !== undefined) {
            if (options.minerPrivateKey.strategy === PrivateKeyStrategy.FromValue) {
                privateKeyArgs.push(`--miner-private-key=${options.minerPrivateKey.privateKey}`);
            } else if (options.minerPrivateKey.strategy === PrivateKeyStrategy.FromSecret) {
                privateKeyArgs.push(`--miner-private-key=$(MINER_PRIVATE_KEY)`);
                envArgs.push({
                    name: "MINER_PRIVATE_KEY",
                    valueFrom: {
                        secretKeyRef: {
                            key: options.minerPrivateKey.secret.key,
                            name: options.minerPrivateKey.secret.name,
                        }
                    }
                });
            }
        }

        new KubeStatefulSet(this, `${id}-statefulset`, {
            metadata: {
                labels: {
                    app: id
                },
                name: id,
            },
            spec: {
                replicas: options.replicas,
                selector: {
                    matchLabels: {
                        app: id,
                    }
                },
                serviceName: id,
                updateStrategy: {
                    type: "OnDelete",
                },
                template: {
                    spec: {
                        containers: [
                            {
                                name: id,
                                image: options.image,
                                command: ["dotnet"],
                                args: [
                                    "NineChronicles.Headless.Executable.dll",
                                    "run",
                                    `--app-protocol-version=${options.appProtocolVersion}`,
                                    `--trusted-app-protocol-version-signer=${options.trustedAppProtocolVersionSigner}`,
                                    ...(options.genesisBlockPath === undefined ? [] : [`--genesis-block-path=${options.genesisBlockPath}`]),
                                    ...(options.workers === undefined ? [] : [`--workers=${options.workers}`]),
                                    ...(options.minimumBroadcastTarget === undefined ? [] : [`--minimum-broadcast-target=${options.minimumBroadcastTarget}`]),
                                    ...(options.txQuotaPerSigner === undefined ? [] : [`--tx-quota-per-signer=${options.txQuotaPerSigner}`]),
                                    ...libplanetArgs,
                                    ...graphqlArgs,
                                    ...iceServersArgs,
                                    ...peersArgs,
                                    ...privateKeyArgs
                                ],
                                ports: [
                                    ...(options.libplanet?.port !== undefined ? [{
                                        containerPort: options.libplanet.port,
                                        name: "node",
                                        protocol: "TCP",
                                    }] : []),
                                    ...(options.graphql?.port !== undefined ?
                                        [{
                                            containerPort: options.graphql.port,
                                            name: "graphql",
                                            protocol: "TCP",
                                        }] : [])
                                ],
                                livenessProbe: options.libplanet?.port !== undefined ? {
                                    failureThreshold: 3,
                                    initialDelaySeconds: 120,
                                    periodSeconds: 5,
                                    successThreshold: 1,
                                    tcpSocket: {
                                        port: IntOrString.fromNumber(options.libplanet.port),
                                    },
                                    timeoutSeconds: 1,
                                } : undefined,
                                env: envArgs,
                                resources: {
                                    requests: {
                                        cpu: Quantity.fromString("1300m"),
                                        memory: Quantity.fromString("5Gi"),
                                    }
                                },
                                volumeMounts: [
                                    {
                                        mountPath: "/data",
                                        name: VOLUME_NAME
                                    }
                                ]
                            },
                        ],
                        restartPolicy: "Always",
                        dnsPolicy: "ClusterFirst",
                    }
                },
                volumeClaimTemplates: [
                    {
                        metadata: {
                            name: VOLUME_NAME,
                        },
                        spec: {
                            accessModes: ["ReadWriteOnce"],
                            resources: {
                                requests: {
                                    storage: Quantity.fromString("100Gi"),
                                }
                            },
                            storageClassName: "gp2-extensible",
                            volumeMode: "FileSystem"
                        }
                    }
                ]
            }
        });

        new KubeService(this, `${id}-service`, {
            metadata: {
                name: id,
            },
            spec: {
                selector: {
                    app: id,
                },
                type: "LoadBalancer",
                ports: [
                    ...(options.libplanet?.port !== undefined ? [{
                        port: options.libplanet.port,
                        targetPort: IntOrString.fromNumber(options.libplanet.port),
                        name: "node",
                    }] : []),
                    ...(options.graphql?.port === undefined
                        ? []
                        : [{
                            name: "graphql",
                            port: options.graphql.port,
                            targetPort: IntOrString.fromNumber(options.graphql.port),
                        }]),
                ]
            }
        });
    }
}
