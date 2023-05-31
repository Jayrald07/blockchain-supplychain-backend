import mongoose, { Schema, SchemaTypes } from "mongoose";

const organization = new Schema({
    organization_username: String,
    organization_password: String,
    organization_type: String,
    organization_user: { type: Schema.Types.ObjectId, ref: 'OrganizationUser' },
    organization_details_id: { type: Schema.Types.ObjectId, ref: 'OrganizationDetails' }
}, { timestamps: true });

const organization_user = new Schema({
    organization_user_name: String,
    organization_user_email: String,
    organization_roles: [{ type: Schema.Types.ObjectId, ref: 'OrganizationRole' }]
});

const organization_role = new Schema({
    organization_role_name: String,
    organization_privilleges: [{ type: Schema.Types.ObjectId, ref: 'OrganizationPrivillege' }]
})

const organization_privillege = new Schema({
    organization_privillege_code: String,
    organization_privillege_name: String,
    organization_privillege_description: String
})

// Status is "used", "waiting"
const organization_id = new Schema({
    organization_details_id: { type: Schema.Types.ObjectId, ref: 'OrganizationDetails' },
    identifier: String,
    status: String
}, { timestamps: true })

const organization_details = new Schema({
    organization_details_id: String,
    organization_type_id: { type: Schema.Types.ObjectId, ref: 'OrganizationType' },
    organization_name: String,
    organization_email: String,
    organization_address: String,
    organization_phone: String,
    organization_ip: String,
    organization_port: String,
    organization_pubkey: String,
    organization_privkey: String,
    organization_email_is_verified: { type: Boolean, default: false },
    organization_display_name: String
}, { timestamps: true })

const organization_verification = new Schema({
    token: String,
    organization_id: { type: Schema.Types.ObjectId, ref: 'OrganizationDetails' },
    email: String,
    status: String
}, { timestamps: true })

const organization_type = new Schema({
    organization_type_id: Schema.Types.ObjectId,
    organization_type_name: String
}, { timestamps: true })

const organization_ou = new Schema({
    organization_id: { type: Schema.Types.ObjectId, ref: 'OrganizationDetails' },
    organization_details_id: { type: Schema.Types.ObjectId, ref: 'OrganizationDetails' },
    status: String
}, { timestamps: true })

const organization_asset = new Schema({
    organization_asset_id: String,
    organization_details_id: { type: Schema.Types.ObjectId, ref: 'OrganizationDetails' },
    asset_id: [{ type: Schema.Types.ObjectId, ref: 'Asset' }]
}, { timestamps: true })

const asset = new Schema({
    asset_id: String,
    asset_name: String,
    asset_uuid: String,
    asset_description: String,
    tag_code: String,
    origin: { type: Schema.Types.ObjectId, ref: 'OrganizationDetails' },
    isDelete: { type: Boolean, default: 0 }
}, { timestamps: true })

const tag = new Schema({
    tag_id: String,
    tag_key: String,
    // NUMBER, PESO, TEXT, TEXTFIELD, OPTIONS
    tag_type: { type: String, default: "TEXT" },
    tag_options: { type: [String], default: [] },
    tag_default_value: { type: String, default: "" },
    organization_id: { type: String, default: "SYSTEM" }
}, { timestamps: true });

const invite = new Schema({
    organization_id: { type: Schema.Types.ObjectId, ref: 'OrganizationDetails' },
    invited_organization_id: { type: Schema.Types.ObjectId, ref: 'OrganizationDetails' },
    // INVITED, ACCEPTED, CONNECTED, REJECTED
    status: { type: String, default: 'INVITED' },
    expiresIn: SchemaTypes.Date,
    dateConnected: SchemaTypes.Date
}, { timestamps: true })

const notification = new Schema({
    organization_id: { type: Schema.Types.ObjectId, ref: 'OrganizationDetails' },
    title: String,
    description: String,
    viewed: { type: Boolean, default: false }
}, { timestamps: true })

const organization_channels_connection = new Schema({
    channelId: String,
    organizationIds: [{ type: Schema.Types.ObjectId, ref: 'OrganizationDetails' }]
}, { timestamps: true })

const client = new Schema({
    username: String,
    password: String,
    access_code: String
});

const Organization = mongoose.model('Organization', organization);
const OrganizationUser = mongoose.model('OrganizationUser', organization_user);
const OrganizationRole = mongoose.model('OrganizationRole', organization_role);
const OrganizationPrivillege = mongoose.model('OrganizationPrivillege', organization_privillege);
const OrganizationType = mongoose.model('OrganizationType', organization_type);
const OrganizationDetails = mongoose.model('OrganizationDetails', organization_details);
const OrganizationOU = mongoose.model('OrganizationOU', organization_ou);
const OrganizationAsset = mongoose.model('OrganizationAsset', organization_asset);
const OrganizationID = mongoose.model("OrganizationID", organization_id);
const Asset = mongoose.model('Asset', asset);
const Tag = mongoose.model('Tag', tag);
const Invite = mongoose.model('Invite', invite);
const Notification = mongoose.model('Notification', notification);
const Verification = mongoose.model('Verification', organization_verification);
const OrganizationChannelConnection = mongoose.model('OrganizationChannelConnection', organization_channels_connection);
const Client = mongoose.model('Client', client);

export default {
    Organization,
    OrganizationType,
    OrganizationDetails,
    OrganizationOU,
    OrganizationAsset,
    OrganizationID,
    Asset,
    Tag,
    Invite,
    Notification,
    Verification,
    OrganizationChannelConnection,
    OrganizationUser,
    OrganizationRole,
    OrganizationPrivillege,
    Client
}