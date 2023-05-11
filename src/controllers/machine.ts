import AWS from "aws-sdk";
import dotenv from "dotenv";
import { createUserDataVm } from "../utils/general";
import { Socket } from "socket.io";

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

export const createVM = async (req: any, res: any) => {
  try {
    const { pk, fc, tempToken, idName, pkeyname } = req.body;
    let io: Socket = req.io;

    const ec2 = new AWS.EC2({
      region: process.env.DEFAULT_REGION
    });

    res.send({ message: "Done", details: "In-Progress" })

    const params = {
      KeyName: pkeyname
    }

    let keyMaterial = "";

    ec2.createKeyPair(params, function (err, data) {
      if (err) return io.emit("vm", { message: "Done", details: "Error creating private key. Try to change the name", end: true })

      keyMaterial = data.KeyMaterial as string
      io.emit("vm", { message: "Done", details: "VM Created", end: false })

      let script = createUserDataVm(pk, fc, idName);

      io.emit("vm", { message: "Done", details: "Creating VM", end: false })

      ec2.runInstances({
        ImageId: process.env.DEFAULT_AMI,
        InstanceType: process.env.DEFAULT_INSTANCE_TYPE,
        KeyName: pkeyname,
        MaxCount: 1,
        MinCount: 1,
        UserData: Buffer.from(script).toString("base64"),
        NetworkInterfaces: [
          {
            DeviceIndex: 0,
            SubnetId: process.env.DEFAULT_SUBNET,
            AssociatePublicIpAddress: true
          }
        ]
      }, function (err, data) {
        if (err) return io.emit("vm", { message: "Error", details: "Error starting VM", end: true })

        let instanceId = data?.Instances?.[0].InstanceId;

        io.emit("vm", { message: "Done", details: "VM started", end: false })

        let state = "instanceRunning"

        io.emit("vm", { message: "Done", details: "Waiting for VM to be in running state", end: false })

        ec2.waitFor("instanceRunning" as any, { InstanceIds: [instanceId as string] }, function (err: any, data: any) {
          if (err) return io.emit("vm", { message: "Error", details: "Error running VM", end: true })

          io.in(tempToken).emit("vm", { message: "Done", details: "Creating static IP", end: false })

          ec2.allocateAddress(function (err, data) {
            if (err) return io.emit("vm", { message: "Error", details: "Error creating static IP", end: true })

            let IP = data.PublicIp;

            io.emit("vm", { message: "Done", details: "Static IP created", end: false })

            ec2.associateAddress({
              AllocationId: data.AllocationId,
              InstanceId: instanceId
            }, function (err, data) {

              if (err) return io.emit("vm", { message: "Error", details: "Error VM creation", end: true })
              else io.emit("vm", { message: "Done", details: "VM Created", end: true, ip: IP, pkey: keyMaterial, username: 'ubuntu' })

            })

          })

        });

      })
    })




  } catch (error: any) {

    res.send({ message: "Error", details: error.message })

  }
}