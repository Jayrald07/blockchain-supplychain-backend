import mongoose, { Schema, SchemaTypes } from "mongoose";

const organization = new Schema({
    organization_username: String,
    organization_password: String,
    organization_details_id: { type: Schema.Types.ObjectId, ref: 'OrganizationDetails' }
}, { timestamps: true });

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
    organization_email_is_verified: { type: Boolean, default: false }
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

const Organization = mongoose.model('Organization', organization);
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
    Verification
}