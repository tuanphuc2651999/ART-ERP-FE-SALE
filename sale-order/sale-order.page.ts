import { Component, ViewChild } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { SALE_OrderProvider, SHIP_ShipmentProvider, SHIP_VehicleProvider, AC_ARInvoiceProvider } from 'src/app/services/static/services.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { lib } from 'src/app/services/static/global-functions';
import { SaleOrderSplitModalPage } from '../sale-order-split-modal/sale-order-split-modal.page';
import { SaleOrderMergeModalPage } from '../sale-order-merge-modal/sale-order-merge-modal.page';
import { SaleOrderARInvoiceModalPage } from '../sale-order-create-arinvoice-modal/sale-order-create-arinvoice-modal.page';
import { SaleOrderMergeARInvoiceModalPage } from '../sale-order-merge-arinvoice-modal/sale-order-merge-arinvoice-modal.page';

import { EInvoiceService } from 'src/app/services/einvoice.service';

@Component({
    selector: 'app-sale-order',
    templateUrl: 'sale-order.page.html',
    styleUrls: ['sale-order.page.scss']
})
export class SaleOrderPage extends PageBase {
    baseURL = ApiSetting.mainService.base;
    branchList = [];
    statusList = [];
    vehicleList = [];
    shipmentList = [];
    contact: any = {};
    isShowExpectedDeliveryDate: boolean = false;

    segmentView = 's1';
    shipmentQuery: any = { IDStatus: 301, DeliveryDate: '', SortBy: 'IDVehicle' };

    masanImportParam: any = {
        featureDate: lib.dateFormat(new Date, 'yyyy-mm-dd'),
        wareHouse: 'KF1652T01',
    };

    constructor(
        public pageProvider: SALE_OrderProvider,
        public shipmentProvider: SHIP_ShipmentProvider,
        public vehicleProvider: SHIP_VehicleProvider,
        public arInvoiceProvider: AC_ARInvoiceProvider,
        public EInvoiceServiceProvider: EInvoiceService,
        public modalController: ModalController,
        public alertCtrl: AlertController,
        public loadingController: LoadingController,
        public env: EnvService,
        public navCtrl: NavController,
    ) {
        super();
        // this.pageConfig.isShowFeature = true;
        this.pageConfig.isShowSearch = false;
        let today = new Date;
        today.setDate(today.getDate() + 1);
        this.shipmentQuery.DeliveryDate = lib.dateFormat(today, 'yyyy-mm-dd');
    }

    events(e) {
        if (e.Code == 'shipment') {
            this.loadShipmentList();
            this.refresh();
        }
    }

    preLoadData(event) {
        this.query.IDOwner = this.pageConfig.canViewAllData ? 'all' : this.env.user.StaffID;
        this.query.IDParent = null;
        //this.query.OrderDate = this.pageConfig.canViewAllData? 'all' : new Date();
        //this.query.IDStatus = '[1,2,3]';
        if (!this.sort.Id) {
            this.sort.Id = 'Id';
            this.sortToggle('Id', true);
        }
        if (!this.query.IDStatus) {
            this.query.IDStatus = '[101,102,103,104,110]';
        }


        Promise.all([
            this.pageProvider.commonService.connect('GET', 'SYS/Config/ConfigByBranch', { Code: 'IsShowExpectedDeliveryDate', IDBranch: this.env.selectedBranch }).toPromise(),
            this.env.getStatus('SalesOrder')
        ]).then((values: any) => {
            if (values[0]['Value']) {
                this.isShowExpectedDeliveryDate = JSON.parse(values[0]['Value']);
            };
            this.statusList = values[1];
            super.preLoadData(event);

        });

        this.loadVehicleList();
        this.loadShipmentList();

    }

    loadedData(event) {
        this.items.forEach(i => {
            i.OrderTimeText = i.OrderDate ? lib.dateFormat(i.OrderDate, 'hh:MM') : '';
            i.OrderDateText = i.OrderDate ? lib.dateFormat(i.OrderDate, 'dd/mm/yy') : '';
            i.Query = i.OrderDate ? lib.dateFormat(i.OrderDate, 'yyyy-mm-dd') : '';

            i.ExpectedDeliveryTimeText = i.ExpectedDeliveryDate ? lib.dateFormat(i.ExpectedDeliveryDate, 'hh:MM') : '';
            i.ExpectedDeliveryDateText = i.ExpectedDeliveryDate ? lib.dateFormat(i.ExpectedDeliveryDate, 'dd/mm/yy') : '';
            i.QueryExpectedDeliveryDate = i.ExpectedDeliveryDate ? lib.dateFormat(i.ExpectedDeliveryDate, 'yyyy-mm-dd') : '';
            
            i.OriginalTotalAfterTaxText = lib.currencyFormat(i.OriginalTotalAfterTax);
            i.TotalAfterTaxText = lib.currencyFormat(i.TotalAfterTax);
        });
        super.loadedData(event);
    }

    loadVehicleList() {
        this.vehicleProvider.read({ IgnoredBranch: true }).then(response => {
            this.vehicleList = response['data'];
            this.vehicleList.forEach(v => {
                if (v.ShipperName) {
                    v.Name = v.Name + ' - ' + v.ShipperName;
                }

            });
        });
    }

    loadShipmentList() {
        this.shipmentProvider.apiPath.getList.url = function () { return ApiSetting.apiDomain("SHIP/Shipment/List") };
        this.shipmentProvider.read(this.shipmentQuery).then((resp: any) => {
            this.shipmentList = resp.data;
            this.shipmentList.forEach(i => {
                i.DeliveryDateText = lib.dateFormat(i.DeliveryDate, 'dd/mm/yy hh:MM');
            });
        });
    }

    showDetail(i) {
        this.navCtrl.navigateForward('/sale-order/' + i.Id);
    }

    add() {
        let newSaleOrder = {
            Id: 0,
        };
        this.showDetail(newSaleOrder);
    }

    masanImport() {
        if (this.submitAttempt) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.importing-masan', 'primary');
            return;
        }
        this.submitAttempt = true;
        this.env.publishEvent({ Code: 'app:ShowAppMessage', IsShow: true, Id: 'MasanImport', Icon: 'flash', IsBlink: true, Color: 'danger', Message: 'đang import đơn Masan' });

        this.pageProvider.commonService.connect('GET', 'SALE/Order/MasanImport', {
            JobId: 1,
            Kho: this.masanImportParam.wareHouse,
            StartDate: this.masanImportParam.featureDate,
            EndDate: this.masanImportParam.featureDate
        }).toPromise().then((fileurl) => {
            this.submitAttempt = false;
            this.env.publishEvent({ Code: 'app:ShowAppMessage', IsShow: false, Id: 'MasanImport' });
            this.pageConfig.isShowSearch = true;
            this.query.IDStatus = '';
            this.refresh()
            this.download(fileurl);
        })
            .catch(err => {
                debugger;
                this.submitAttempt = false;
                this.env.publishEvent({ Code: 'app:ShowAppMessage', IsShow: false, Id: 'MasanImport' });
                //this.refresh();
                if (err.error.Message != null && err.error != null) {
                    this.env.showMessage(err.message, 'danger');
                }
                else {
                    this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.import-error', 'danger');
                }
            })
    }

    @ViewChild('importfile2') importfile: any;
    onClickImport() {
        this.importfile.nativeElement.value = "";
        this.importfile.nativeElement.click();
    }

    async import2(event) {
        if (this.submitAttempt) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.importing', 'primary');
            return;
        }
        this.submitAttempt = true;
        this.env.publishEvent({ Code: 'app:ShowAppMessage', IsShow: true, Id: 'FileImport', Icon: 'flash', IsBlink: true, Color: 'danger', Message: 'đang import' });

        let selectedBranch = this.env.selectedBranch;
        this.pageProvider.apiPath.postImport.method = "UPLOAD";
        this.pageProvider.apiPath.postImport.url = function () { return ApiSetting.apiDomain("SALE/Order/ImportFile?IDBranch=" + selectedBranch) };

        this.pageProvider.import(event.target.files[0])
            .then((response) => {
                this.submitAttempt = false;
                this.env.publishEvent({ Code: 'app:ShowAppMessage', IsShow: false, Id: 'FileImport' });
                this.refresh();
                this.download(response);

            })
            .catch(err => {
                this.submitAttempt = false;
                this.env.publishEvent({ Code: 'app:ShowAppMessage', IsShow: false, Id: 'FileImport' });
                this.refresh();
                this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.import-error', 'danger');
            })


    }

    async splitSaleOrder() {
        let IDStatus = this.selectedItems[0].IDStatus;
        if (!(IDStatus == 101 || IDStatus == 102 || IDStatus == 103)) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-split', 'warning');
            return;
        }
        const modal = await this.modalController.create({
            component: SaleOrderSplitModalPage,
            swipeToClose: true,
            cssClass: 'modal90',
            componentProps: {
                'selectedOrder': this.selectedItems[0]
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();

        this.selectedItems = [];
        this.refresh();
    }

    async mergeSaleOrders() {
        let itemsCanNotProcess = this.selectedItems.filter(i => !(i.IDStatus == 101 || i.IDStatus == 102 || i.IDStatus == 103));
        if (itemsCanNotProcess.length) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-merge', 'warning');
            return;
        }

        const modal = await this.modalController.create({
            component: SaleOrderMergeModalPage,
            swipeToClose: true,
            cssClass: 'modal-merge-orders',
            componentProps: {
                'selectedOrders': this.selectedItems
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();

        this.selectedItems = [];
        this.refresh();
    }

    submitOrdersForApproval() {
        if (!this.pageConfig.canApprove) {
            return;
        }

        let itemsCanNotProcess = this.selectedItems.filter(i => !(i.IDStatus == 101 || i.IDStatus == 102));
        if (itemsCanNotProcess.length == this.selectedItems.length) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-send-approve-new-draft-disapprove-only', 'warning');
        }
        else {
            itemsCanNotProcess.forEach(i => {
                i.checked = false;
            });
            this.selectedItems = this.selectedItems.filter(i => (i.IDStatus == 101 || i.IDStatus == 102));

            this.alertCtrl.create({
                header: 'Gửi duyệt ' + this.selectedItems.length + ' đơn hàng',
                //subHeader: '---',
                message: 'Bạn chắc muốn gửi duyệt ' + this.selectedItems.length + ' đơn hàng đang chọn?',
                buttons: [
                    {
                        text: 'Không',
                        role: 'cancel',
                        handler: () => {
                            //console.log('Không xóa');
                        }
                    },
                    {
                        text: 'Gửi duyệt',
                        cssClass: 'danger-btn',
                        handler: () => {

                            let publishEventCode = this.pageConfig.pageName;
                            let apiPath = {
                                method: "POST",
                                url: function () { return ApiSetting.apiDomain("SALE/Order/SubmitOrdersForApproval/") }
                            };

                            if (this.submitAttempt == false) {
                                this.submitAttempt = true;

                                let postDTO = { Ids: [] };
                                postDTO.Ids = this.selectedItems.map(e => e.Id);

                                this.pageProvider.commonService.connect(apiPath.method, apiPath.url(), postDTO).toPromise()
                                    .then((savedItem: any) => {
                                        if (publishEventCode) {
                                            this.env.publishEvent({ Code: publishEventCode });
                                        }
                                        this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.save-complete', 'warning');
                                        this.submitAttempt = false;

                                    }).catch(err => {
                                        this.submitAttempt = false;
                                        //console.log(err);
                                    });
                            }

                        }
                    }
                ]
            }).then(alert => {
                alert.present();
            })
        }
    }

    approveOrders() {
        if (!this.pageConfig.canApprove) {
            return;
        }

        let itemsCanNotProcess = this.selectedItems.filter(i => !(i.IDStatus == 103 || i.IDStatus == 110));
        if (itemsCanNotProcess.length == this.selectedItems.length) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-approve-pending-only', 'warning');
        }
        else {
            itemsCanNotProcess.forEach(i => {
                i.checked = false;
            });
            this.selectedItems = this.selectedItems.filter(i => (i.IDStatus == 103 || i.IDStatus == 110));

            this.alertCtrl.create({
                header: 'Duyệt ' + this.selectedItems.length + ' đơn hàng',
                //subHeader: '---',
                message: 'Bạn chắc muốn xác nhận ' + this.selectedItems.length + ' đơn hàng đang chọn?',
                buttons: [
                    {
                        text: 'Không',
                        role: 'cancel',
                        handler: () => {
                            //console.log('Không xóa');
                        }
                    },
                    {
                        text: 'Duyệt',
                        cssClass: 'danger-btn',
                        handler: () => {

                            let publishEventCode = this.pageConfig.pageName;
                            let apiPath = {
                                method: "POST",
                                url: function () { return ApiSetting.apiDomain("SALE/Order/ApproveOrders/") }
                            };

                            if (this.submitAttempt == false) {
                                this.submitAttempt = true;

                                let postDTO = { Ids: [] };
                                postDTO.Ids = this.selectedItems.map(e => e.Id);

                                this.pageProvider.commonService.connect(apiPath.method, apiPath.url(), postDTO).toPromise()
                                    .then((savedItem: any) => {
                                        if (publishEventCode) {
                                            this.env.publishEvent({ Code: publishEventCode });
                                        }
                                        this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.save-complete', 'success');
                                        this.submitAttempt = false;

                                    }).catch(err => {
                                        this.submitAttempt = false;
                                        //console.log(err);
                                    });
                            }

                        }
                    }
                ]
            }).then(alert => {
                alert.present();
            })
        }
    }

    disapproveOrders() {
        if (!this.pageConfig.canApprove) {
            return;
        }

        let itemsCanNotProcess = this.selectedItems.filter(i => !(i.IDStatus == 103 || i.IDStatus == 104));
        if (itemsCanNotProcess.length == this.selectedItems.length) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-disapprove-pending-approved-only', 'warning');
        }
        else {
            itemsCanNotProcess.forEach(i => {
                i.checked = false;
            });
            this.selectedItems = this.selectedItems.filter(i => (i.IDStatus == 103 || i.IDStatus == 104));

            this.alertCtrl.create({
                header: 'Trả lại ' + this.selectedItems.length + ' đơn hàng',
                //subHeader: '---',
                message: 'Bạn chắc muốn trả lại ' + this.selectedItems.length + ' đơn hàng đang chọn?',
                buttons: [
                    {
                        text: 'Không',
                        role: 'cancel',
                        handler: () => {
                            //console.log('Không xóa');
                        }
                    },
                    {
                        text: 'Trả lại',
                        cssClass: 'danger-btn',
                        handler: () => {

                            let publishEventCode = this.pageConfig.pageName;
                            let apiPath = {
                                method: "POST",
                                url: function () { return ApiSetting.apiDomain("SALE/Order/DisapproveOrders/") }
                            };

                            if (this.submitAttempt == false) {
                                this.submitAttempt = true;

                                let postDTO = { Ids: [] };
                                postDTO.Ids = this.selectedItems.map(e => e.Id);

                                this.pageProvider.commonService.connect(apiPath.method, apiPath.url(), postDTO).toPromise()
                                    .then((savedItem: any) => {
                                        if (publishEventCode) {
                                            this.env.publishEvent({ Code: publishEventCode });
                                        }
                                        this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.save-complete', 'success');
                                        this.submitAttempt = false;

                                    }).catch(err => {
                                        this.submitAttempt = false;
                                        //console.log(err);
                                    });
                            }

                        }
                    }
                ]
            }).then(alert => {
                alert.present();
            })
        }
    }

    cancelOrders() {

        if (!this.pageConfig.canCancel) {
            return;
        }

        let itemsCanNotProcess = this.selectedItems.filter(i => !(i.IDStatus == 101 || i.IDStatus == 102 || i.IDStatus == 103 || i.IDStatus == 110));
        if (itemsCanNotProcess.length == this.selectedItems.length) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-cancel-pending-draft-only', 'warning');
        }
        else {
            itemsCanNotProcess.forEach(i => {
                i.checked = false;
            });
            this.selectedItems = this.selectedItems.filter(i => (i.IDStatus == 101 || i.IDStatus == 102 || i.IDStatus == 103 || i.IDStatus == 110));

            this.alertCtrl.create({
                header: 'HỦY ' + this.selectedItems.length + ' đơn hàng',
                //subHeader: '---',
                message: 'Bạn chắc muốn HỦY ' + this.selectedItems.length + ' đơn hàng đang chọn?',
                buttons: [
                    {
                        text: 'Không',
                        role: 'cancel',
                        handler: () => {
                            //console.log('Không xóa');
                        }
                    },
                    {
                        text: 'Hủy',
                        cssClass: 'danger-btn',
                        handler: () => {

                            let publishEventCode = this.pageConfig.pageName;
                            let apiPath = {
                                method: "POST",
                                url: function () { return ApiSetting.apiDomain("SALE/Order/CancelOrders/") }
                            };

                            if (this.submitAttempt == false) {
                                this.submitAttempt = true;

                                let postDTO = { Ids: [] };
                                postDTO.Ids = this.selectedItems.map(e => e.Id);

                                this.pageProvider.commonService.connect(apiPath.method, apiPath.url(), postDTO).toPromise()
                                    .then((savedItem: any) => {
                                        if (publishEventCode) {
                                            this.env.publishEvent({ Code: publishEventCode });
                                        }
                                        this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.save-complete', 'success');
                                        this.submitAttempt = false;

                                    }).catch(err => {
                                        this.submitAttempt = false;
                                        //console.log(err);
                                    });
                            }

                        }
                    }
                ]
            }).then(alert => {
                alert.present();
            })
        }

    }

    deleteItems() {
        let itemsCanNotDelete = this.selectedItems.filter(i => !(i.IDStatus == 101 || i.IDStatus == 102));
        if (itemsCanNotDelete.length == this.selectedItems.length) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-delete-new-disapprove-only', 'warning');
        }
        else if (itemsCanNotDelete.length) {
            this.alertCtrl.create({
                header: 'Có ' + itemsCanNotDelete.length + ' đơn không thể xóa',
                //subHeader: '---',
                message: 'Bạn có muốn bỏ qua ' + this.selectedItems.length + ' đơn này và tiếp tục xóa?',
                buttons: [
                    {
                        text: 'Không',
                        role: 'cancel',
                        handler: () => {
                            //console.log('Không xóa');
                        }
                    },
                    {
                        text: 'Đồng tiếp tục',
                        cssClass: 'danger-btn',
                        handler: () => {
                            itemsCanNotDelete.forEach(i => {
                                i.checked = false;
                            });
                            this.selectedItems = this.selectedItems.filter(i => (i.IDStatus == 101 || i.IDStatus == 102));
                            super.deleteItems();
                        }
                    }
                ]
            }).then(alert => {
                alert.present();
            })
        }
        else {
            super.deleteItems();
        }



    }

    addSOtoShipment(s) {
        let OrderIds = this.selectedItems.filter(i => i.IDStatus == 104 || i.IDStatus == 110); //Đã duyệt || chờ giao lại
        let DebtOrderIds = this.selectedItems.filter(i => i.IDStatus == 113); // Đang nợ
        if (!(OrderIds.length || DebtOrderIds.length)) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-add-to-shipment', 'warning');
            return;
        }

        let shipment = {
            Id: s.Id,
            OrderIds: OrderIds.map(e => e.Id),
            DebtOrderIds: DebtOrderIds.map(e => e.Id)
        };

        let publishEventCode = this.pageConfig.pageName;
        let apiPath = {
            method: "PUT",
            url: function () { return ApiSetting.apiDomain("SHIP/Shipment/QuickAddSO/") }
        };

        if (this.submitAttempt == false) {
            this.submitAttempt = true;

            this.pageProvider.commonService.connect(apiPath.method, apiPath.url(), shipment).toPromise()
                .then((savedItem: any) => {
                    if (publishEventCode) {
                        this.env.publishEvent({ Code: publishEventCode });
                    }
                    this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.save-complete', 'success');
                    this.loadShipmentList();
                    this.submitAttempt = false;

                }).catch(err => {
                    this.submitAttempt = false;
                    this.loadShipmentList();
                    this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-save', 'danger');
                    //console.log(err);
                });
        }

    }

    async createARInvoice() {
        if (!this.pageConfig.canAddARInvoice) {
            return;
        }

        let itemsCanNotProcess = this.selectedItems.filter(i => (i.IDStatus == 101 || i.IDStatus == 102 || i.IDStatus == 103 || i.IDStatus == 110 || i.IDStatus == 111 || i.IDStatus == 112 || i.IDStatus == 115));
        if (itemsCanNotProcess.length == this.selectedItems.length) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-create-arinvoice', 'warning');
            return;
        }

        itemsCanNotProcess.forEach(i => {
            i.checked = false;
        });
        this.selectedItems = this.selectedItems.filter(i => (i.IDStatus == 104 || i.IDStatus == 105 || i.IDStatus == 106 || i.IDStatus == 107 || i.IDStatus == 108 || i.IDStatus == 109 || i.IDStatus == 113 || i.IDStatus == 114));

        let ids = this.selectedItems.map(m => m.Id)

        // ids.forEach((id, index) => {
        //     this.arInvoiceProvider.read({ IDSaleOrder: id }).then(ar => {
        //         ids.splice(index, id);

        //     });
        // })

        for (let index = 0; index < ids.length; index++) {
            const id = ids[index];
            this.arInvoiceProvider.read({ IDSaleOrder: id }).then(ar => {
                ids.splice(index, id);
            });
        }
        console.log(ids);

        if (!ids) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-create-already', 'warning');
        }
        else {
            //return new Promise(resolve => {
            this.EInvoiceServiceProvider.CreateARInvoiceFromSOs(ids).then((resp: any) => {
                if (resp != '') {
                    this.env.showMessage(resp[0].errorMsg, 'warning');
                    this.submitAttempt = false;
                }
                else {
                    this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.invoice-complete', 'success');
                    //this.env.showMessage('Đã cập nhật hóa đơn điện tử thành công!', 'success');
                    this.submitAttempt = false;
                }
            })
                .catch(err => {
                    console.log(err);

                })
            //})
        }
    }

    async createMergeARInvoice() {
        if (!this.pageConfig.canAddARInvoice) {
            return;
        }

        let itemsCanNotProcess = this.selectedItems.filter(i => (i.IDStatus != 104));
        if (itemsCanNotProcess.length == this.selectedItems.length) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-create-merge-arinvoice', 'warning');
            return;
        }

        itemsCanNotProcess.forEach(i => {
            i.checked = false;
        });

        this.selectedItems = this.selectedItems.filter(i => (i.IDStatus == 104));

        let ids = this.selectedItems.map(m => m.Id)

        //bổ sung các SO con (nếu có)
        ids.forEach(id => {
            let subSOs = this.items.filter(ii => (ii.IDParent == id));

            if (subSOs) {
                subSOs.forEach(so => {
                    this.selectedItems.push(so);
                    so.checked = true;
                });
            }
        })

        const modal = await this.modalController.create({
            component: SaleOrderMergeARInvoiceModalPage,
            swipeToClose: true,
            cssClass: 'modal90',
            componentProps: {
                'selectedOrders': this.selectedItems
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();

        this.selectedItems = [];
        this.refresh();
    }

    async createSplitARInvoices() {

        let IDStatus = this.selectedItems[0].IDStatus;
        if (IDStatus != 104) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-create-split-arinvoice', 'warning');
            return;
        }

        const modal = await this.modalController.create({
            component: SaleOrderARInvoiceModalPage,
            swipeToClose: true,
            cssClass: 'modal90',
            componentProps: {
                'selectedOrder': this.selectedItems[0]
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();

        this.selectedItems = [];
        this.refresh();
    }

    toggleRow(i, event) {


        if (!i._HasSubOrder) {
            return;
        }
        event.stopPropagation();

        if (i._ShowSubOrder) {
            i._ShowSubOrder = false;
            let subOrders = this.items.filter(d => d.IDParent == i.Id);

            subOrders.forEach(it => {
                const index = this.items.indexOf(it, 0);
                if (index > -1) {
                    this.items.splice(index, 1);
                    console.log(index);

                }
                //this.items = [...this.items];
            });

        }
        else {
            let idx = this.items.indexOf(i, 0) + 1;

            if (i._SubOrders) {
                this.items = [...this.items.slice(0, idx), ...i._SubOrders, ...this.items.slice(idx)];
                i._ShowSubOrder = true;
            }
            else {
                this.env.showLoading('Đang tải dữ liệu...', this.pageProvider.read({ IDParent: i.Id }))
                    .then((result: any) => {
                        i._SubOrders = result.data;
                        this.items = [...this.items.slice(0, idx), ...i._SubOrders, ...this.items.slice(idx)];
                        i._ShowSubOrder = true;

                    }).catch(err => {
                        if (err.message != null) {
                            this.env.showMessage(err.message, 'danger');
                        }
                        else {
                            this.env.showTranslateMessage('erp.app.pages.bi.sales-report.message.can-not-get-data', 'danger');
                        }
                    });
            }
        }
    }
}
