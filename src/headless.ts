// import { Deployment, Protocol } from "cdk8s-plus-22";
import { Construct } from "constructs";
import { KubeService, IntOrString, Quantity } from "cdk8s-plus-22/lib/imports/k8s";
import { KubeStatefulSet } from "../imports/k8s";

interface HostAndPort { host: string, port: number };

type LogLevel = "error" | "warning" | "information" | "debug" | "verbose"

export interface HeadlessOptions {
    image: string,
    logLevel: LogLevel,
    workers: number | undefined,
    appProtocolVersion: string,
    libplanet: HostAndPort,
    graphql: HostAndPort | undefined,
    iceServers: string[] | undefined,
    peers: string[] | undefined,
    privateKey: string,
    store: {
        type: string,
        path: string,
    }
    chainTipStaleBehaviour: string,
    minimumBroadcastTarget: number,
};

export class Explorer extends Construct {
    constructor(scope: Construct, id: string, options: HeadlessOptions) {
        super(scope, id);

        const VOLUME_NAME = `${id}-data`;

        const iceServers = options.iceServers || [];
        const iceServersArgs = iceServers.flatMap(iceServer => ["--ice-server", iceServer]);

        const peers = options.peers || [];
        const peersArgs = peers.map(peer => `--peer=${peer}`);

        const graphqlArgs = options.graphql === undefined
            ? []
            : [
                `--graphql-server`,
                `--graphql-host=${options.graphql.host}`,
                `--graphql-port=${options.graphql.port}`
            ];

        new KubeStatefulSet(this, `${id}-statefulset`, {
            metadata: {
                labels: {
                    app: id
                },
                name: id,
            },
            spec: {
                replicas: 1,
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
                                    `--log-level=${options.logLevel}`,
                                    `--app-protocol-version=${options.appProtocolVersion}`,
                                    `--host=${options.libplanet.host}`,
                                    `--port=${options.libplanet.port}`,
                                    ...(options.workers === undefined ? [] : [`--workers=${options.workers}`]),
                                    `--private-key=${options.privateKey}`,
                                    ...graphqlArgs,
                                    ...iceServersArgs,
                                    ...peersArgs,
                                ],
                                ports: [
                                    {
                                        containerPort: options.libplanet.port,
                                        name: "node",
                                        protocol: "TCP",
                                    },
                                    ...(options.graphql !== undefined ?
                                        [{
                                            containerPort: options.graphql.port,
                                            name: "graphql",
                                            protocol: "TCP",
                                        }] : [])
                                ],
                                livenessProbe: {
                                    failureThreshold: 3,
                                    initialDelaySeconds: 120,
                                    periodSeconds: 5,
                                    successThreshold: 1,
                                    tcpSocket: {
                                        port: IntOrString.fromNumber(options.libplanet.port),
                                    },
                                    timeoutSeconds: 1,
                                },
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
                    {
                        name: "node",
                        port: options.libplanet.port,
                        targetPort: IntOrString.fromNumber(options.libplanet.port),
                    },
                    ...(options.graphql === undefined
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
