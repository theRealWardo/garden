# `kubernetes` reference

Below is the schema reference for the `kubernetes` provider. For an introduction to configuring a Garden project with providers, please look at our [configuration guide](../../using-garden/configuration-files.md).

The reference is divided into two sections. The [first section](#configuration-keys) lists and describes the available schema keys. The [second section](#complete-yaml-schema) contains the complete YAML schema.

## Configuration keys

### `providers`

| Type            | Required | Default |
| --------------- | -------- | ------- |
| `array[object]` | No       | `[]`    |

### `providers[].environments[]`

[providers](#providers) > environments

If specified, this provider will only be used in the listed environments. Note that an empty array effectively disables the provider. To use a provider in all environments, omit this field.

| Type            | Required |
| --------------- | -------- |
| `array[string]` | No       |

Example:

```yaml
providers:
  - environments:
    - dev
    - stage
```

### `providers[].buildMode`

[providers](#providers) > buildMode

Choose the mechanism for building container images before deploying. By default it uses the local Docker
daemon, but you can set it to `cluster-docker` or `kaniko` to sync files to a remote Docker daemon,
installed in the cluster, and build container images there. This removes the need to run Docker or
Kubernetes locally, and allows you to share layer and image caches between multiple developers, as well
as between your development and CI workflows.

This is currently experimental and sometimes not desired, so it's not enabled by default. For example when using
the `local-kubernetes` provider with Docker for Desktop and Minikube, we directly use the in-cluster docker
daemon when building. You might also be deploying to a remote cluster that isn't intended as a development
environment, so you'd want your builds to happen elsewhere.

Functionally, both `cluster-docker` and `kaniko` do the same thing, but use different underlying mechanisms
to build. The former uses a normal Docker daemon in the cluster. Because this has to run in privileged mode,
this is less secure than Kaniko, but in turn it is generally faster. See the
[Kaniko docs](https://github.com/GoogleContainerTools/kaniko) for more information on Kaniko.

| Type     | Required | Default          |
| -------- | -------- | ---------------- |
| `string` | No       | `"local-docker"` |

### `providers[].defaultHostname`

[providers](#providers) > defaultHostname

A default hostname to use when no hostname is explicitly configured for a service.

| Type     | Required |
| -------- | -------- |
| `string` | No       |

Example:

```yaml
providers:
  - defaultHostname: "api.mydomain.com"
```

### `providers[].defaultUsername`

[providers](#providers) > defaultUsername

Set a default username (used for namespacing within a cluster).

| Type     | Required |
| -------- | -------- |
| `string` | No       |

### `providers[].forceSsl`

[providers](#providers) > forceSsl

Require SSL on all `container` module services. If set to true, an error is raised when no certificate is available for a configured hostname on a `container` module.

| Type      | Required | Default |
| --------- | -------- | ------- |
| `boolean` | No       | `false` |

### `providers[].imagePullSecrets[]`

[providers](#providers) > imagePullSecrets

References to `docker-registry` secrets to use for authenticating with remote registries when pulling
images. This is necessary if you reference private images in your module configuration, and is required
when configuring a remote Kubernetes environment with buildMode=local.

| Type            | Required | Default |
| --------------- | -------- | ------- |
| `array[object]` | No       | `[]`    |

### `providers[].imagePullSecrets[].name`

[providers](#providers) > [imagePullSecrets](#providers[].imagepullsecrets[]) > name

The name of the Kubernetes secret.

| Type     | Required |
| -------- | -------- |
| `string` | Yes      |

Example:

```yaml
providers:
  - imagePullSecrets:
      - name: "my-secret"
```

### `providers[].imagePullSecrets[].namespace`

[providers](#providers) > [imagePullSecrets](#providers[].imagepullsecrets[]) > namespace

The namespace where the secret is stored. If necessary, the secret may be copied to the appropriate namespace before use.

| Type     | Required | Default     |
| -------- | -------- | ----------- |
| `string` | No       | `"default"` |

### `providers[].resources`

[providers](#providers) > resources

Resource requests and limits for the in-cluster builder, container registry and code sync service. (which are automatically installed and used when `buildMode` is `cluster-docker` or `kaniko`).

| Type     | Required | Default                                                                                                                                                                                                                                                    |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `object` | No       | `{"builder":{"limits":{"cpu":4000,"memory":8192},"requests":{"cpu":200,"memory":512}},"registry":{"limits":{"cpu":2000,"memory":4096},"requests":{"cpu":200,"memory":512}},"sync":{"limits":{"cpu":500,"memory":512},"requests":{"cpu":100,"memory":64}}}` |

### `providers[].resources.builder`

[providers](#providers) > [resources](#providers[].resources) > builder

Resource requests and limits for the in-cluster builder.

When `buildMode` is `cluster-docker`, this refers to the Docker Daemon that is installed and run
cluster-wide. This is shared across all users and builds, so it should be resourced accordingly, factoring
in how many concurrent builds you expect and how heavy your builds tend to be.

When `buildMode` is `kaniko`, this refers to _each instance_ of Kaniko, so you'd generally use lower
limits/requests, but you should evaluate based on your needs.

| Type     | Required | Default                                                                     |
| -------- | -------- | --------------------------------------------------------------------------- |
| `object` | No       | `{"limits":{"cpu":4000,"memory":8192},"requests":{"cpu":200,"memory":512}}` |

### `providers[].resources.builder.limits`

[providers](#providers) > [resources](#providers[].resources) > [builder](#providers[].resources.builder) > limits

| Type     | Required | Default                      |
| -------- | -------- | ---------------------------- |
| `object` | No       | `{"cpu":4000,"memory":8192}` |

### `providers[].resources.builder.limits.cpu`

[providers](#providers) > [resources](#providers[].resources) > [builder](#providers[].resources.builder) > [limits](#providers[].resources.builder.limits) > cpu

CPU limit in millicpu.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `4000`  |

Example:

```yaml
providers:
  - resources:
      ...
      builder:
        ...
        limits:
          ...
          cpu: 4000
```

### `providers[].resources.builder.limits.memory`

[providers](#providers) > [resources](#providers[].resources) > [builder](#providers[].resources.builder) > [limits](#providers[].resources.builder.limits) > memory

Memory limit in megabytes.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `8192`  |

Example:

```yaml
providers:
  - resources:
      ...
      builder:
        ...
        limits:
          ...
          memory: 8192
```

### `providers[].resources.builder.requests`

[providers](#providers) > [resources](#providers[].resources) > [builder](#providers[].resources.builder) > requests

| Type     | Required | Default                    |
| -------- | -------- | -------------------------- |
| `object` | No       | `{"cpu":200,"memory":512}` |

### `providers[].resources.builder.requests.cpu`

[providers](#providers) > [resources](#providers[].resources) > [builder](#providers[].resources.builder) > [requests](#providers[].resources.builder.requests) > cpu

CPU request in millicpu.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `200`   |

Example:

```yaml
providers:
  - resources:
      ...
      builder:
        ...
        requests:
          ...
          cpu: 200
```

### `providers[].resources.builder.requests.memory`

[providers](#providers) > [resources](#providers[].resources) > [builder](#providers[].resources.builder) > [requests](#providers[].resources.builder.requests) > memory

Memory request in megabytes.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `512`   |

Example:

```yaml
providers:
  - resources:
      ...
      builder:
        ...
        requests:
          ...
          memory: 512
```

### `providers[].resources.registry`

[providers](#providers) > [resources](#providers[].resources) > registry

Resource requests and limits for the in-cluster image registry. Built images are pushed to this registry,
so that they are available to all the nodes in your cluster.

This is shared across all users and builds, so it should be resourced accordingly, factoring
in how many concurrent builds you expect and how large your images tend to be.

| Type     | Required | Default                                                                     |
| -------- | -------- | --------------------------------------------------------------------------- |
| `object` | No       | `{"limits":{"cpu":2000,"memory":4096},"requests":{"cpu":200,"memory":512}}` |

### `providers[].resources.registry.limits`

[providers](#providers) > [resources](#providers[].resources) > [registry](#providers[].resources.registry) > limits

| Type     | Required | Default                      |
| -------- | -------- | ---------------------------- |
| `object` | No       | `{"cpu":2000,"memory":4096}` |

### `providers[].resources.registry.limits.cpu`

[providers](#providers) > [resources](#providers[].resources) > [registry](#providers[].resources.registry) > [limits](#providers[].resources.registry.limits) > cpu

CPU limit in millicpu.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `2000`  |

Example:

```yaml
providers:
  - resources:
      ...
      registry:
        ...
        limits:
          ...
          cpu: 2000
```

### `providers[].resources.registry.limits.memory`

[providers](#providers) > [resources](#providers[].resources) > [registry](#providers[].resources.registry) > [limits](#providers[].resources.registry.limits) > memory

Memory limit in megabytes.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `4096`  |

Example:

```yaml
providers:
  - resources:
      ...
      registry:
        ...
        limits:
          ...
          memory: 4096
```

### `providers[].resources.registry.requests`

[providers](#providers) > [resources](#providers[].resources) > [registry](#providers[].resources.registry) > requests

| Type     | Required | Default                    |
| -------- | -------- | -------------------------- |
| `object` | No       | `{"cpu":200,"memory":512}` |

### `providers[].resources.registry.requests.cpu`

[providers](#providers) > [resources](#providers[].resources) > [registry](#providers[].resources.registry) > [requests](#providers[].resources.registry.requests) > cpu

CPU request in millicpu.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `200`   |

Example:

```yaml
providers:
  - resources:
      ...
      registry:
        ...
        requests:
          ...
          cpu: 200
```

### `providers[].resources.registry.requests.memory`

[providers](#providers) > [resources](#providers[].resources) > [registry](#providers[].resources.registry) > [requests](#providers[].resources.registry.requests) > memory

Memory request in megabytes.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `512`   |

Example:

```yaml
providers:
  - resources:
      ...
      registry:
        ...
        requests:
          ...
          memory: 512
```

### `providers[].resources.sync`

[providers](#providers) > [resources](#providers[].resources) > sync

Resource requests and limits for the code sync service, which we use to sync build contexts to the cluster
ahead of building images. This generally is not resource intensive, but you might want to adjust the
defaults if you have many concurrent users.

| Type     | Required | Default                                                                  |
| -------- | -------- | ------------------------------------------------------------------------ |
| `object` | No       | `{"limits":{"cpu":500,"memory":512},"requests":{"cpu":100,"memory":64}}` |

### `providers[].resources.sync.limits`

[providers](#providers) > [resources](#providers[].resources) > [sync](#providers[].resources.sync) > limits

| Type     | Required | Default                    |
| -------- | -------- | -------------------------- |
| `object` | No       | `{"cpu":500,"memory":512}` |

### `providers[].resources.sync.limits.cpu`

[providers](#providers) > [resources](#providers[].resources) > [sync](#providers[].resources.sync) > [limits](#providers[].resources.sync.limits) > cpu

CPU limit in millicpu.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `500`   |

Example:

```yaml
providers:
  - resources:
      ...
      sync:
        ...
        limits:
          ...
          cpu: 500
```

### `providers[].resources.sync.limits.memory`

[providers](#providers) > [resources](#providers[].resources) > [sync](#providers[].resources.sync) > [limits](#providers[].resources.sync.limits) > memory

Memory limit in megabytes.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `512`   |

Example:

```yaml
providers:
  - resources:
      ...
      sync:
        ...
        limits:
          ...
          memory: 512
```

### `providers[].resources.sync.requests`

[providers](#providers) > [resources](#providers[].resources) > [sync](#providers[].resources.sync) > requests

| Type     | Required | Default                   |
| -------- | -------- | ------------------------- |
| `object` | No       | `{"cpu":100,"memory":64}` |

### `providers[].resources.sync.requests.cpu`

[providers](#providers) > [resources](#providers[].resources) > [sync](#providers[].resources.sync) > [requests](#providers[].resources.sync.requests) > cpu

CPU request in millicpu.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `100`   |

Example:

```yaml
providers:
  - resources:
      ...
      sync:
        ...
        requests:
          ...
          cpu: 100
```

### `providers[].resources.sync.requests.memory`

[providers](#providers) > [resources](#providers[].resources) > [sync](#providers[].resources.sync) > [requests](#providers[].resources.sync.requests) > memory

Memory request in megabytes.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `64`    |

Example:

```yaml
providers:
  - resources:
      ...
      sync:
        ...
        requests:
          ...
          memory: 64
```

### `providers[].storage`

[providers](#providers) > storage

Storage parameters to set for the in-cluster builder, container registry and code sync persistent volumes
(which are automatically installed and used when `buildMode` is `cluster-docker` or `kaniko`).

These are all shared cluster-wide across all users and builds, so they should be resourced accordingly,
factoring in how many concurrent builds you expect and how large your images and build contexts tend to be.

| Type     | Required | Default                                                                                                                                  |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `object` | No       | `{"builder":{"size":20480,"storageClass":null},"registry":{"size":20480,"storageClass":null},"sync":{"size":10240,"storageClass":null}}` |

### `providers[].storage.builder`

[providers](#providers) > [storage](#providers[].storage) > builder

Storage parameters for the data volume for the in-cluster Docker Daemon.

Only applies when `buildMode` is set to `cluster-docker`, ignored otherwise.

| Type     | Required | Default                              |
| -------- | -------- | ------------------------------------ |
| `object` | No       | `{"size":20480,"storageClass":null}` |

### `providers[].storage.builder.size`

[providers](#providers) > [storage](#providers[].storage) > [builder](#providers[].storage.builder) > size

Volume size for the registry in megabytes.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `20480` |

### `providers[].storage.builder.storageClass`

[providers](#providers) > [storage](#providers[].storage) > [builder](#providers[].storage.builder) > storageClass

Storage class to use for the volume.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `string` | No       | `null`  |

### `providers[].storage.registry`

[providers](#providers) > [storage](#providers[].storage) > registry

Storage parameters for the in-cluster Docker registry volume. Built images are stored here, so that they
are available to all the nodes in your cluster.

Only applies when `buildMode` is set to `cluster-docker` or `kaniko`, ignored otherwise.

| Type     | Required | Default                              |
| -------- | -------- | ------------------------------------ |
| `object` | No       | `{"size":20480,"storageClass":null}` |

### `providers[].storage.registry.size`

[providers](#providers) > [storage](#providers[].storage) > [registry](#providers[].storage.registry) > size

Volume size for the registry in megabytes.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `20480` |

### `providers[].storage.registry.storageClass`

[providers](#providers) > [storage](#providers[].storage) > [registry](#providers[].storage.registry) > storageClass

Storage class to use for the volume.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `string` | No       | `null`  |

### `providers[].storage.sync`

[providers](#providers) > [storage](#providers[].storage) > sync

Storage parameters for the code sync volume, which build contexts are synced to ahead of running
in-cluster builds.

Only applies when `buildMode` is set to `cluster-docker` or `kaniko`, ignored otherwise.

| Type     | Required | Default                              |
| -------- | -------- | ------------------------------------ |
| `object` | No       | `{"size":10240,"storageClass":null}` |

### `providers[].storage.sync.size`

[providers](#providers) > [storage](#providers[].storage) > [sync](#providers[].storage.sync) > size

Volume size for the registry in megabytes.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `10240` |

### `providers[].storage.sync.storageClass`

[providers](#providers) > [storage](#providers[].storage) > [sync](#providers[].storage.sync) > storageClass

Storage class to use for the volume.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `string` | No       | `null`  |

### `providers[].tlsCertificates[]`

[providers](#providers) > tlsCertificates

One or more certificates to use for ingress.

| Type            | Required | Default |
| --------------- | -------- | ------- |
| `array[object]` | No       | `[]`    |

### `providers[].tlsCertificates[].name`

[providers](#providers) > [tlsCertificates](#providers[].tlscertificates[]) > name

A unique identifier for this certificate.

| Type     | Required |
| -------- | -------- |
| `string` | Yes      |

Example:

```yaml
providers:
  - tlsCertificates:
      - name: "wildcard"
```

### `providers[].tlsCertificates[].hostnames[]`

[providers](#providers) > [tlsCertificates](#providers[].tlscertificates[]) > hostnames

A list of hostnames that this certificate should be used for. If you don't specify these, they will be automatically read from the certificate.

| Type            | Required |
| --------------- | -------- |
| `array[string]` | No       |

Example:

```yaml
providers:
  - tlsCertificates:
      - hostnames:
        - www.mydomain.com
```

### `providers[].tlsCertificates[].secretRef`

[providers](#providers) > [tlsCertificates](#providers[].tlscertificates[]) > secretRef

A reference to the Kubernetes secret that contains the TLS certificate and key for the domain.

| Type     | Required |
| -------- | -------- |
| `object` | No       |

Example:

```yaml
providers:
  - tlsCertificates:
      - secretRef:
          name: my-tls-secret
          namespace: default
```

### `providers[].tlsCertificates[].secretRef.name`

[providers](#providers) > [tlsCertificates](#providers[].tlscertificates[]) > [secretRef](#providers[].tlscertificates[].secretref) > name

The name of the Kubernetes secret.

| Type     | Required |
| -------- | -------- |
| `string` | Yes      |

Example:

```yaml
providers:
  - tlsCertificates:
      - secretRef:
          name: my-tls-secret
          namespace: default
          ...
          name: "my-secret"
```

### `providers[].tlsCertificates[].secretRef.namespace`

[providers](#providers) > [tlsCertificates](#providers[].tlscertificates[]) > [secretRef](#providers[].tlscertificates[].secretref) > namespace

The namespace where the secret is stored. If necessary, the secret may be copied to the appropriate namespace before use.

| Type     | Required | Default     |
| -------- | -------- | ----------- |
| `string` | No       | `"default"` |

### `providers[].name`

[providers](#providers) > name

The name of the provider plugin to use.

| Type     | Required | Default        |
| -------- | -------- | -------------- |
| `string` | Yes      | `"kubernetes"` |

Example:

```yaml
providers:
  - name: "kubernetes"
```

### `providers[].context`

[providers](#providers) > context

The kubectl context to use to connect to the Kubernetes cluster.

| Type     | Required |
| -------- | -------- |
| `string` | Yes      |

Example:

```yaml
providers:
  - context: "my-dev-context"
```

### `providers[].deploymentRegistry`

[providers](#providers) > deploymentRegistry

The registry where built containers should be pushed to, and then pulled to the cluster when deploying services.

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `providers[].deploymentRegistry.hostname`

[providers](#providers) > [deploymentRegistry](#providers[].deploymentregistry) > hostname

The hostname (and optionally port, if not the default port) of the registry.

| Type     | Required |
| -------- | -------- |
| `string` | Yes      |

Example:

```yaml
providers:
  - deploymentRegistry:
      ...
      hostname: "gcr.io"
```

### `providers[].deploymentRegistry.port`

[providers](#providers) > [deploymentRegistry](#providers[].deploymentregistry) > port

The port where the registry listens on, if not the default.

| Type     | Required |
| -------- | -------- |
| `number` | No       |

### `providers[].deploymentRegistry.namespace`

[providers](#providers) > [deploymentRegistry](#providers[].deploymentregistry) > namespace

The namespace in the registry where images should be pushed.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `string` | No       | `"_"`   |

Example:

```yaml
providers:
  - deploymentRegistry:
      ...
      namespace: "my-project"
```

### `providers[].ingressClass`

[providers](#providers) > ingressClass

The ingress class to use on configured Ingresses (via the `kubernetes.io/ingress.class` annotation)
when deploying `container` services. Use this if you have multiple ingress controllers in your cluster.

| Type     | Required |
| -------- | -------- |
| `string` | No       |

### `providers[].ingressHttpPort`

[providers](#providers) > ingressHttpPort

The external HTTP port of the cluster's ingress controller.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `80`    |

### `providers[].ingressHttpsPort`

[providers](#providers) > ingressHttpsPort

The external HTTPS port of the cluster's ingress controller.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `number` | No       | `443`   |

### `providers[].namespace`

[providers](#providers) > namespace

Specify which namespace to deploy services to (defaults to <project name>). Note that the framework generates other namespaces as well with this name as a prefix.

| Type     | Required |
| -------- | -------- |
| `string` | No       |

### `providers[].setupIngressController`

[providers](#providers) > setupIngressController

Set this to `nginx` to install/enable the NGINX ingress controller.

| Type     | Required | Default |
| -------- | -------- | ------- |
| `string` | No       | `false` |


## Complete YAML schema

The values in the schema below are the default values.

```yaml
providers:
  - environments:
    buildMode: local-docker
    defaultHostname:
    defaultUsername:
    forceSsl: false
    imagePullSecrets:
      - name:
        namespace: default
    resources:
      builder:
        limits:
          cpu: 4000
          memory: 8192
        requests:
          cpu: 200
          memory: 512
      registry:
        limits:
          cpu: 2000
          memory: 4096
        requests:
          cpu: 200
          memory: 512
      sync:
        limits:
          cpu: 500
          memory: 512
        requests:
          cpu: 100
          memory: 64
    storage:
      builder:
        size: 20480
        storageClass: null
      registry:
        size: 20480
        storageClass: null
      sync:
        size: 10240
        storageClass: null
    tlsCertificates:
      - name:
        hostnames:
        secretRef:
          name:
          namespace: default
    name: kubernetes
    context:
    deploymentRegistry:
      hostname:
      port:
      namespace: _
    ingressClass:
    ingressHttpPort: 80
    ingressHttpsPort: 443
    namespace:
    setupIngressController: false
```
