# JWT key rotator

Simple NodeJS container that will rotate the keys in a kubernetes secret.

## Workflow

1. Fetch the current JWKS from the secret
2. Generate a new key pair with unique ID
3. Add the new public key to the JWKS
4. Remove the oldest key from the JWKS if the number of keys exceeds the maximum
5. Patch the secret with the new JWKS

## Requirements

Service requires to have a kubernetes service account with the following role:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: jwt-keys-rotator
  namespace: <your-namespace>
rules:
  - apiGroups: ['']
    resources: ['secrets']
    resourceNames:
      - <your-secret-name>
    verbs: ['get', 'patch']
```

## Configuration

Following environment variables can be set to configure the service:
| Variable | Description | Default | Possible values |
|----------|-------------|---------|-----------------|
| `NAMESPACE` | The namespace where the secrets are located | | Any non-empty string |
| `SECRET_NAME` | The name of the secret | `jwt-keys` | Any non-empty string |
| `MAX_KEYS` | The maximum number of keys to keep | `2` | Any integer greater than 0 |
| `KEYS_TYPE` | Algorithm and size of the generated keys | `ed25519` | `rsa-2048`, `rsa-4096`, `ed25519`, `ed448` |

## Usage

Service is usually deployed as a cron job.

### Example deployment

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: jwt-keys-rotator
  namespace: <your-namespace>
spec:
  schedule: <your-schedule>
  failedJobsHistoryLimit: 1
  successfulJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: <service-account-name>
          containers:
            - name: jwt-keys-rotator
              image: docker.hexagonale.net/jwt-keys-rotator:latest
              resources:
                requests:
                  memory: '32Mi'
                  cpu: '100m'
                limits:
                  memory: '64Mi'
                  cpu: '200m'
              env:
                - name: NAMESPACE
                  valueFrom:
                    fieldRef:
                      fieldPath: metadata.namespace
                - name: SECRET_NAME
                  value: jwt-keys
                - name: MAX_KEYS
                  value: '2'
          restartPolicy: OnFailure
```
