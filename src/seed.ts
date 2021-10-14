// import { Deployment, Protocol } from "cdk8s-plus-22";
import { Construct } from "constructs";
import { KubeDeployment, KubeService, IntOrString, Quantity } from "cdk8s-plus-22/lib/imports/k8s";

interface HostAndPort { host: string, port: number };

type LogLevel = "error" | "warning" | "information" | "debug" | "verbose"

export interface SeedOptions {
    image: string,
    logLevel: LogLevel,
    workers: number | undefined,
    appProtocolVersion: string,
    libplanet: HostAndPort,
    graphql: HostAndPort | undefined,
    privateKey: string,
};

export class Seed extends Construct {
    constructor(scope: Construct, id: string, options: SeedOptions) {
        super(scope, id);

        new KubeDeployment(this, `${id}-deployment`, {
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
                template: {
                    spec: {
                        containers: [
                            {
                                name: id,
                                image: options.image,
                                command: ["dotnet"],
                                args: [
                                    "Libplanet.Seed.Executable.dll",
                                    "run",
                                    `--log-level=${options.logLevel}`,
                                    `--app-protocol-version=${options.appProtocolVersion}`,
                                    `--host=${options.libplanet.host}`,
                                    `--port=${options.libplanet.port}`,
                                    ...(options.workers === undefined ? [] : [`--workers=${options.workers}`]),
                                    `--private-key=${options.privateKey}`,
                                    ...(options.graphql === undefined
                                        ? []
                                        : [
                                            `--graphql-host=${options.graphql.host}`,
                                            `--graphql-port=${options.graphql.port}`
                                        ]),
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
                                        cpu: Quantity.fromString(String(1)),
                                    }
                                }
                            }
                        ],
                        dnsPolicy: "ClusterFirst",
                    }
                }
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
