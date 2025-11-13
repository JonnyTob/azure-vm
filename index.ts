import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import * as configuration from "./configuration";
import * as fs from "fs";
import * as certificates from "./certificates";
import * as path from "path";
// import { ResourceGroup } from "@pulumi/azure-native/resources";

const vm_name = "vm-mgmt-linux-poc";
const rg_name = "int-apim-poc-vm";
const VMadminUsername = "int-admin";
// Pre made script for testing Persontjenesten API
const scriptPath = "./scripts/api_persontjenesten.sh";      
const scriptText = fs.readFileSync(scriptPath, "utf8");
// Prepare script for embedding in bash command
const scriptTextEncoded = scriptText.replace(/'/g, `'\\''`);

// TO-DO. Theese should be fetched from exisiting code
const subscriptionId = "fdf0eb5e-de6d-4533-809d-a6a18426edb8";
const netRg = "int-apim-poc-nwe-main-rg-4203";           
const vnetName = "int-apim-poc-nwe-apim-vnet-d990";
const subnetName = "int-apim-poc-nwe-apim-subnet-5588";
const subnetId = `/subscriptions/${subscriptionId}/resourceGroups/${netRg}` +
  `/providers/Microsoft.Network/virtualNetworks/${vnetName}/subnets/${subnetName}`;


// paste your *public* SSH key string here (PUBLIC ONLY!)
const sshPublicKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFCXOrEr8rroKFzRHy+Xz/MDaR4mMZtqH419vftxoIqg admin_vm";
const tags = configuration.getTags();

//
// Provisioning of resources
//
const rg_resourcegroup = new azure_native.resources.ResourceGroup("int-apim-poc-vm-jt", {
    resourceGroupName: rg_name,
    location: "norwayeast",
});

const subnet = azure_native.network.getSubnetOutput({
  resourceGroupName: netRg,
  virtualNetworkName: vnetName,
  subnetName: subnetName,
});

// Use the looked-up subnet.id when creating the NIC
const nic = new azure_native.network.NetworkInterface(`${vm_name}-nic`, {
  resourceGroupName: rg_resourcegroup.name,
  location: rg_resourcegroup.location,
  tags: tags,
  ipConfigurations: [{
    name: `${vm_name}_ipconfig1`,
    privateIPAllocationMethod: "Dynamic",
    subnet: {
         id: subnetId 
    },    
    // optional
    // publicIPAddress: { id: pip.id },                     
  }],
});

const vm_mgmt_linux = new azure_native.compute.VirtualMachine("vm-mgmt-linux", {
    vmName: vm_name,
    location: rg_resourcegroup.location,
    resourceGroupName: rg_resourcegroup.name,
    additionalCapabilities: {
        hibernationEnabled: false,
    },
    diagnosticsProfile: {
        bootDiagnostics: {
            enabled: true,
        },
    },
    hardwareProfile: {
        vmSize: azure_native.compute.VirtualMachineSizeTypes.Standard_B2s,
    },
    identity: {
        type: azure_native.compute.ResourceIdentityType.SystemAssigned,
    },
    networkProfile: {
        networkInterfaces: [{
            id: nic.id,
            primary: true,
            deleteOption: azure_native.compute.DeleteOptions.Delete,
        }],
    },
    osProfile: {
        adminUsername: VMadminUsername,
        allowExtensionOperations: true,
        computerName: vm_name,
        //requireGuestProvisionSignal: true,
        linuxConfiguration: {
            disablePasswordAuthentication: true,
            provisionVMAgent: true,
            patchSettings: {
                assessmentMode: azure_native.compute.LinuxPatchAssessmentMode.ImageDefault,
                patchMode: azure_native.compute.LinuxVMGuestPatchMode.ImageDefault,
            },
        ssh: {
            publicKeys: [{
                keyData: sshPublicKey,
                path: `/home/${VMadminUsername}/.ssh/authorized_keys`,
                }],
            },
        },
    },
    securityProfile: {
        securityType: azure_native.compute.SecurityTypes.TrustedLaunch,
        uefiSettings: {
            secureBootEnabled: true,
            vTpmEnabled: true,
        },
    },
    storageProfile: {
        diskControllerType: azure_native.compute.DiskControllerTypes.SCSI,
        imageReference: {
            offer: "ubuntu-24_04-lts",
            publisher: "canonical",
            sku: "server",
            version: "latest",
        },
        osDisk: {
            name: `${vm_name}_OSdisk`,         
            managedDisk: {
                storageAccountType: azure_native.compute.StorageAccountTypes.StandardSSD_LRS,
            },
            diskSizeGB: 30,
            caching: azure_native.compute.CachingTypes.ReadWrite,
            createOption: azure_native.compute.DiskCreateOptionTypes.FromImage,
            deleteOption: azure_native.compute.DiskDeleteOptionTypes.Delete,
            osType: azure_native.compute.OperatingSystemTypes.Linux,
        },
    },
    tags: tags,
});

// Install VM extension after VM is created
const aadSsh = new azure_native.compute.VirtualMachineExtension("aad-ssh-login", {
    vmName: vm_mgmt_linux.name,
    resourceGroupName: rg_resourcegroup.name,
    location: rg_resourcegroup.location,
    publisher: "Microsoft.Azure.ActiveDirectory",
    type: "AADSSHLoginForLinux",
    typeHandlerVersion: "1.0",
});

// Install add-ons, copy scripts, copy CA certs, etc.
const installTools = new azure_native.compute.VirtualMachineExtension("install-tools", {
    vmName: vm_mgmt_linux.name,
    resourceGroupName: rg_resourcegroup.name,
    location: rg_resourcegroup.location,
    publisher: "Microsoft.Azure.Extensions",
    type: "customScript",
    typeHandlerVersion: "2.1",
    settings: {
        // Install Azure CLI, CA certs, copy script to VM
        commandToExecute: `
        #!/bin/bash
        set -e
        sudo apt-get update
        sudo apt-get install -y ca-certificates curl apt-transport-https lsb-release gnupg
        sudo mkdir -p /etc/apt/keyrings
        curl -sL https://packages.microsoft.com/keys/microsoft.asc | \
            gpg --dearmor | sudo tee /etc/apt/keyrings/microsoft.gpg > /dev/null
        AZ_REPO=$(lsb_release -cs)
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/microsoft.gpg] \
        https://packages.microsoft.com/repos/azure-cli/ $AZ_REPO main" | \
            sudo tee /etc/apt/sources.list.d/azure-cli.list
        sudo apt-get update
        sudo apt-get install -y azure-cli
        printf '%s' '${scriptTextEncoded}' > /home/${VMadminUsername}/${path.basename(scriptPath)}
        chown ${VMadminUsername}:${VMadminUsername} /home/${VMadminUsername}/${path.basename(scriptPath)}
        chmod 0755 /home/${VMadminUsername}/${path.basename(scriptPath)}
        echo "${certificates.helseNordRootCaCertBase64}" | sudo tee /usr/local/share/ca-certificates/helse_nord_root_ca.crt
        echo "${certificates.helseNordIssuingCaCertificateBase64}" | sudo tee /usr/local/share/ca-certificates/helse_nord_issuing_ca_01.crt
        sudo update-ca-certificates
        `,
    },
});


// TO-DO Need to add HNIKT CA certs to trusted store in the VM - must be done vis script extension above

export const vmId = vm_mgmt_linux.id;
export const nicId = nic.id;
