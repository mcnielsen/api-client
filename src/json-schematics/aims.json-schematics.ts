/**
 * A collection of json schemas corresponding to AIMS endpoints.
 */

/* tslint:disable:variable-name */
export const AIMSJsonSchematics = {
    Authentication: {
        "$id": "https://api.cloudinsight.alertlogic.com/schemas/aims/authenticate.json",
        "type": "object",
        "required": [ "authentication" ],
        "properties": {
            "authentication": { "$ref": "#/definitions/authentication" }
        },
        "definitions": {
            "authentication": {
                "type": "object",
                "description": "Authentication Response Body",
                "required": [ "token", "token_expiration", "user", "account" ],
                "properties": {
                    "token": {
                        "type": "string",
                        "description": "AIMS Access Token"
                    },
                    "token_expiration": {
                        "type": "number",
                        "description": "Token Expiration"
                    },
                    "user":     { "$ref": "common.json#/definitions/user" },
                    "account":  { "$ref": "common.json#/definitions/account" }
                },
            }
        }
    },

    Common: {
        "$id": "https://api.cloudinsight.alertlogic.com/schemas/aims/common.json",
        "definitions": {
            "user": {
                "type": "object",
                "required": [ "id", "name", "email", "active", "locked", "linked_users", "created", "modified" ],
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "User ID"
                    },
                    "name": {
                        "type": "string",
                        "description": "User name"
                    },
                    "email": {
                        "type": "string",
                        "description": "User Email Address"
                    },
                    "active": {
                        "type": "boolean",
                        "description": "User Active Flag"
                    },
                    "locked": {
                        "type": "boolean",
                        "description": "User Locked Flag"
                    },
                    "linked_users": {
                        "type": "array",
                        "items": { "$ref": "#/definitions/linked_user" }
                    },
                    "created": { "$ref": "#/definitions/changestamp" },
                    "modified": { "$ref": "#/definitions/changestamp" }
                }
            },
            "account": {
                "type": "object",
                "required": [ "id", "name", "active", "accessible_locations", "default_location", "created", "modified" ],
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "Account ID"
                    },
                    "name": {
                        "type": "string",
                        "description": "Account Name"
                    },
                    "active": {
                        "type": "boolean",
                        "description": "Account Activity Flag"
                    },
                    "accessible_locations": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Accessible Location IDs"
                    },
                    "default_location": {
                        "type": "string",
                        "description": "Default Location ID"
                    },
                    "mfa_required": {
                        "type": "boolean",
                        "description": "MFA Required?"
                    },
                    "created": { "$ref": "#/definitions/changestamp" },
                    "modified": { "$ref": "#/definitions/changestamp" }
                }
            },
            "changestamp": {
                "type": "object",
                "required": [ "by", "at" ],
                "properties": {
                    "by": {
                        "type": "string",
                        "description": "User ID"
                    },
                    "at": {
                        "type": "number",
                        "description": "Timestamp"
                    }
                }
            },
            "linked_user": {
                "type": "object",
                "required": [ "location", "user_id" ],
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "Linked Location ID"
                    },
                    "user_id": {
                        "type": "number",
                        "description": "Linked User ID"
                    }
                }
            }
        }
    }
};
