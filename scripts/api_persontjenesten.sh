#!/bin/bash
ACCESS_TOKEN=$(az account get-access-token --query accessToken -o tsv)

echo -e "Token from Azure STS reveived (rember login)"
echo "$ACCESS_TOKEN"

echo "--------- Calling Persontjenesten APIM /health  -------"
curl -s -X GET --resolve int-apim-poc.azure-api.net:443:100.120.160.7 https://int-apim-poc.azure-api.net/persontjenesten/health \
-H "Authorization: Bearer $ACCESS_TOKEN" \
-H "Accept: application/json" \
-H "Ocp-Apim-Trace:  true" | jq . 
echo ""

echo "---------- Calling Persontjenesten APIM /person/get-by-nin  -------"
curl -s -X POST --resolve int-apim-poc.azure-api.net:443:100.120.160.7 https://int-apim-poc.azure-api.net/persontjenesten/api/v3/full-access/person/get-by-nin?informationParts=Birth \
-H "Authorization: Bearer $ACCESS_TOKEN" \
-H "Accept: application/json" \
-H "Ocp-Apim-Trace:  true"  \
-H "Content-Type: application/x-www-form-urlencoded" \
--data-raw 'nin=48895100539' | jq .
echo ""