
// Reference: https://docs.helsenord.no/spaces/SP/pages/808499274/POC+Tagging+-+Azure
export function getTags() {
    return {
        // Required subscription tags
        workloadName: "Integrasjonsplattform",
        costCenter: "7100",
        environment: "dev", // dev, test, qa, prod -- poc is not considered a valid value, see https://docs.helsenord.no/spaces/SP/pages/904440396/POC+Navn+p%C3%A5+milj%C3%B8+-+Environment
        serviceCategory: "Integrasjon",
        businessCriticality: "tn3",

        // Optional subscription tags
        business: "Felles",
        configurationId: "CI58295",
        customer: "Felles - alle HF",
        projectNumber: "180281",

        // Optional resource tags
        productTeam: "Integrasjonsteam",
        // lifecycle: "",
        // version: "",
        createdby: "pulumi",
    }
};