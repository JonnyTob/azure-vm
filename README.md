## Pulumi script for creating Ubuntu VM

Oppretter en small Ubuntu VM med AZ Cli for lettere kunne teste/feilsøke ressurser i Azure.

Merknader:

Generate private+public keyPair in seperate files. Used for SSH
NB! Private key er secret og skal ikke ligge i repo!
```
ssh-keygen -t ed25519 -C "SSH Key" -f ssh_key
```

