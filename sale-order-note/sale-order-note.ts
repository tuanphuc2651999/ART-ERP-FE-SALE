import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { BRA_BranchProvider, CRM_ContactProvider, SALE_OrderProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import QRCode from 'qrcode'
import { lib } from 'src/app/services/static/global-functions';

@Component({
    selector: 'app-sale-order-note',
    templateUrl: 'sale-order-note.page.html',
    styleUrls: ['sale-order-note.page.scss']
})
export class SaleOrderNotePage extends PageBase {

    statusList = [];
    branch;
    customer;
    
    constructor(
        public pageProvider: SALE_OrderProvider,
        public contactProvider: CRM_ContactProvider,
        public branchProvider: BRA_BranchProvider,
        public modalController: ModalController,
        public alertCtrl: AlertController,
        public loadingController: LoadingController,
        public env: EnvService,
        public navCtrl: NavController,
        public location: Location,
        public route: ActivatedRoute,
    ) {
        super();
        this.pageConfig.isShowFeature = true;
        this.pageConfig.pageName = 'sale-order-note';
        this.id = this.route.snapshot.paramMap.get('id');

        this.query.Id = '[985, 1616]'
        this.query.IDStatus = '[104, 105, 109, 113, 114]'; // đã duyệt/đã giao việc/đã giao hàng/done/còn nợ
    }


    isShowPackingUoM = true;

    preLoadData(event) {
        Promise.all([
            this.env.getStatus('SALE'),
        ]).then((values: any) => {
            this.statusList = values[0];
            super.preLoadData(event);
        });
        // this.statusProvider.read({ IDParent: 11 }).then(response => {
        //   this.statusList = response['data'];
        //   super.preLoadData(event);

        // });
    }

    loadedData(event) {
        super.loadedData(event);
        if (window.location.host.indexOf('artlogistics') > -1) {
			this.isShowPackingUoM = false;
		}
        
        this.items.forEach(i => {
            i.OrderDateText = lib.dateFormat(i.OrderDate, 'dd/mm/yy hh:MM');
            i.ExpectedReceiptDateText = lib.dateFormat(i.ExpectedReceiptDate, 'dd/mm/yy hh:MM');
            i.OrderTimeText = lib.dateFormat(i.OrderDate, 'hh:MM');
        });

        if (this.id) {
            this.item = this.items.filter(d => d.Id == this.id)
            if (this.item.length != 0) {
                this.loadSaleOrderNote({ Id: this.id , IDBranch: this.item[0]?.IDBranch, IDContact: this.item[0]?.IDContact});
            }
        }
    }


    selectedSaleOrderID = 0;
    sheets: any[] = [];
    loadSaleOrderNote(i) {

        this.selectedSaleOrderID = i.Id;
        this.id = this.selectedSaleOrderID;

        let newURL = `#/${this.pageConfig.pageName}/${this.id}`;// '#'+this.pageConfig.pageName + '/' + this.id;
        history.pushState({}, null, newURL);

        this.submitAttempt = true;

        this.loadingController.create({
            cssClass: 'my-custom-class',
            message: 'Đang tạo phiếu bán hàng...'
        }).then(loading => {
            loading.present();

            this.pageProvider.getAnItem(i.Id).then(resp => {
                this.sheets = [];
                this.sheets.push(resp);

                    this.branchProvider.getAnItem(i.IDBranch).then((branch: any) => {
                      this.branch = branch;

                      this.contactProvider.getAnItem(i.IDContact).then((customer: any) => {
                        this.customer = customer;
  
                        for (let si = 0; si < this.sheets.length; si++) {
                            const o = this.sheets[si];
                            const so = this.items.filter(d => d.Id == o.Id);
                            // o.BranchName = so[0].BranchName;
        
                            o.BranchName = so[0].BranchName;
                            o.BranchLogoURL = this.branch?.LogoURL;
                            o.BranchAddress = this.branch?.Address;
                            o.CustomerAddress = this.customer?.BillingAddress;
        
                            o.CustomerName = so[0].CustomerName;
                            o.WorkPhone = so[0].WorkPhone;
        
                            o.OrderDateText = lib.dateFormat(o.OrderDate, 'dd/mm/yy hh:MM');
                            o.StatusText = lib.getAttrib(o.IDStatus, this.env.statusList, 'Name', 'NA', 'Id');
                            
                            o.CalcTotal = 0;
                            o.CalcTotalService = 0;
                            o.CalcTotalTax = 0;
                            o.CalcTotalAfterTax = 0;
        
                            QRCode.toDataURL('PO:' + o.Id, { errorCorrectionLevel: 'H', version: 2, width: 500, scale: 20, type: 'image/webp' }, function (err, url) {
                                o.QRC = url;
                            })
        
                            o.OrderLines.sort((a, b) => (parseFloat(a.ItemSort) - parseFloat(b.ItemSort)));
                            o.OrderLines.forEach(l => {
                                l.UoMPriceText = lib.formatMoney(l.UoMPrice, 0);
                                l.TotalBeforeDiscountText = lib.formatMoney(l.TotalBeforeDiscount, 0);
                                l.TotalDiscountText = lib.formatMoney(l.TotalDiscount, 0);
                                l.TotalAfterDiscountText = lib.formatMoney(l.TotalAfterDiscount, 0);
                                l.TotalAfterTaxText = lib.formatMoney(l.TotalAfterTax, 0);
        
                                // Phí Phục Vụ ( hoặc là theo phí phục vụ từ server, hoặc là 5% )
                                l.ServiceRate = l.ServiceRate ? l.ServiceRate : 5;
        
                                // Đơn giá * Số lượng
                                l.Total = l.UoMPrice * l.Quantity;
                                l.TotalText = lib.formatMoney(l.Total, 0);
        
                                // Thành tiền phục vụ
                                l.TotalService = (l.Total * l.ServiceRate) / 100 ;
                                l.TotalServiceText = lib.formatMoney(l.TotalService, 0);
        
                                // Thành tiền VAT = (Thành tiền * %VAT)    //Note: Thành tiền = UoMPrice * Quantity (Service Charge Included)
                                l.TotalTax = (l.Total  * l.TaxRate) / 100;
                                l.TotalTaxText = lib.formatMoney(l.TotalTax, 0);
                                
                                //Tổng tiền sau Thuế của 1 Order Line
                                l.TotalAfterTax = l.Total + l.TotalTax
                                l.TotalAfterTaxText = lib.formatMoney(l.TotalAfterTax, 0);
        
                                o.CalcTotal += (l.Total);
                                o.CalcTotalService += (l.TotalService);
                                o.CalcTotalTax += (l.TotalTax);
                                o.CalcTotalAfterTax += (l.TotalAfterTax);
        
                            });
        
                            o.CalcTotalText = lib.formatMoney(o.CalcTotal, 0);
                            o.CalcTotalServiceText = lib.formatMoney(o.CalcTotalService, 0);
                            o.CalcTotalTaxText = lib.formatMoney(o.CalcTotalTax, 0);
                            o.CalcTotalAfterTaxText = lib.formatMoney(o.CalcTotalAfterTax, 0);
        
                            o.TotalRemain = o.TotalAfterTax - o.Debt;
                            o.TotalRemainText = lib.formatMoney(o.TotalRemain, 0);
        
                            o.TotalBeforeDiscountText = lib.formatMoney(o.TotalBeforeDiscount, 0);
                            o.TotalDiscountText = lib.formatMoney(o.TotalDiscount, 0);
                            o.TotalAfterDiscountText = lib.formatMoney(o.TotalAfterDiscount, 0);
                            o.TaxText = lib.formatMoney(o.Tax, 0);
                            o.DebtText = lib.formatMoney(o.Debt, 0);
                            o.TotalAfterTaxText = lib.formatMoney(o.TotalAfterTax, 0);
                            o.DocTienBangChu = this.DocTienBangChu(o.TotalAfterTax);
                        };
                      });
                    });

                this.submitAttempt = false;
                if (loading) loading.dismiss();
                setTimeout(() => {
                    this.calcPageBreak();
                }, 100);

            }).catch(err => {
                console.log(err);
                if (err.message != null) {
                    this.env.showMessage(err.message, 'danger');
                }
                else {
                    this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-create-order','danger');
                }
                this.submitAttempt = false;
                if (loading) loading.dismiss();
            });

        });
    }





    printMode = 'A4';
    changePrintMode() {
        this.printMode = this.printMode == 'A4' ? 'A5' : 'A4';
        this.calcPageBreak();
    }

    calcPageBreak() {
        let sheets = document.querySelectorAll('.sheet');

        var e = document.createElement("div");
        e.style.position = "absolute";
        e.style.width = "147mm";
        document.body.appendChild(e);
        var rect = e.getBoundingClientRect();
        document.body.removeChild(e);
        let A5Height = rect.width;

        if (this.printMode == 'A5') {
            sheets.forEach((s: any) => {
                s.style.pageBreakAfter = 'always';
                s.style.borderBottom = 'none';
                s.style.minHeight = '147mm';

                if (s.clientHeight > A5Height * 6 + 20) {
                    s.style.minHeight = '1180mm';
                }
                else if (s.clientHeight > A5Height * 4 + 20) {
                    s.style.minHeight = '885mm';
                }
                else if (s.clientHeight > A5Height * 2 + 20) {
                    s.style.minHeight = '590mm';
                }
                else if (s.clientHeight > A5Height + 20) {
                    s.style.minHeight = '295mm';
                }
            });
        }
        else {
            sheets.forEach((s: any) => {
                s.style.breakAfter = 'unset';
                s.style.minHeight = '148mm';
                //s.style.borderBottom = 'dashed 1px #ccc';

                if (s.clientHeight > A5Height * 6 + 20) {
                    s.style.minHeight = '1180mm';
                    s.style.pageBreakBefore = 'always';
                    s.style.pageBreakAfter = 'always';
                }
                else if (s.clientHeight > A5Height * 4 + 20) {
                    s.style.minHeight = '885mm';
                    s.style.pageBreakBefore = 'always';
                    s.style.pageBreakAfter = 'always';
                }
                else if (s.clientHeight > A5Height * 2 + 20) {
                    s.style.minHeight = '590mm';
                    s.style.pageBreakBefore = 'always';
                    s.style.pageBreakAfter = 'always';
                }
                else if (s.clientHeight > A5Height + 20) {
                    s.style.minHeight = '295mm';
                    s.style.pageBreakBefore = 'always';
                    s.style.pageBreakAfter = 'always';
                }
            });
        }
    }

    DocSo3ChuSo(baso) {
        var ChuSo = new Array(" không ", " một ", " hai ", " ba ", " bốn ", " năm ", " sáu ", " bảy ", " tám ", " chín ");

        var tram;
        var chuc;
        var donvi;
        var KetQua = "";
        tram = parseInt((baso / 100) + '');
        chuc = parseInt(((baso % 100) / 10) + '');
        donvi = baso % 10;
        if (tram == 0 && chuc == 0 && donvi == 0) return "";
        if (tram != 0) {
            KetQua += ChuSo[tram] + " trăm ";
            if ((chuc == 0) && (donvi != 0)) KetQua += " linh ";
        }
        if ((chuc != 0) && (chuc != 1)) {
            KetQua += ChuSo[chuc] + " mươi";
            if ((chuc == 0) && (donvi != 0)) KetQua = KetQua + " linh ";
        }
        if (chuc == 1) KetQua += " mười ";
        switch (donvi) {
            case 1:
                if ((chuc != 0) && (chuc != 1)) {
                    KetQua += " mốt ";
                }
                else {
                    KetQua += ChuSo[donvi];
                }
                break;
            case 5:
                if (chuc == 0) {
                    KetQua += ChuSo[donvi];
                }
                else {
                    KetQua += " lăm ";
                }
                break;
            default:
                if (donvi != 0) {
                    KetQua += ChuSo[donvi];
                }
                break;
        }
        return KetQua;
    }

    DocTienBangChu(SoTien) {
        var Tien = new Array("", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ");

        var lan = 0;
        var i = 0;
        var so = 0;
        var KetQua = "";
        var tmp = "";
        var ViTri = new Array();
        if (SoTien < 0) return "Số tiền âm !";
        if (SoTien == 0) return "Không đồng !";
        if (SoTien > 0) {
            so = SoTien;
        }
        else {
            so = -SoTien;
        }
        if (SoTien > 8999999999999999) {
            //SoTien = 0;
            return "Số quá lớn!";
        }
        ViTri[5] = Math.floor(so / 1000000000000000);
        if (isNaN(ViTri[5]))
            ViTri[5] = "0";
        so = so - parseFloat(ViTri[5].toString()) * 1000000000000000;
        ViTri[4] = Math.floor(so / 1000000000000);
        if (isNaN(ViTri[4]))
            ViTri[4] = "0";
        so = so - parseFloat(ViTri[4].toString()) * 1000000000000;
        ViTri[3] = Math.floor(so / 1000000000);
        if (isNaN(ViTri[3]))
            ViTri[3] = "0";
        so = so - parseFloat(ViTri[3].toString()) * 1000000000;
        ViTri[2] = parseInt((so / 1000000) + '');
        if (isNaN(ViTri[2]))
            ViTri[2] = "0";
        ViTri[1] = parseInt(((so % 1000000) / 1000) + '');
        if (isNaN(ViTri[1]))
            ViTri[1] = "0";
        ViTri[0] = parseInt((so % 1000) + '');
        if (isNaN(ViTri[0]))
            ViTri[0] = "0";
        if (ViTri[5] > 0) {
            lan = 5;
        }
        else if (ViTri[4] > 0) {
            lan = 4;
        }
        else if (ViTri[3] > 0) {
            lan = 3;
        }
        else if (ViTri[2] > 0) {
            lan = 2;
        }
        else if (ViTri[1] > 0) {
            lan = 1;
        }
        else {
            lan = 0;
        }
        for (i = lan; i >= 0; i--) {
            tmp = this.DocSo3ChuSo(ViTri[i]);
            KetQua += tmp;
            if (ViTri[i] > 0) KetQua += Tien[i];
            if ((i > 0) && (tmp.length > 0)) KetQua += ',';//&& (!string.IsNullOrEmpty(tmp))
        }
        if (KetQua.substring(KetQua.length - 1) == ',') {
            KetQua = KetQua.substring(0, KetQua.length - 1);
        }
        KetQua = KetQua.substring(1, 2).toUpperCase() + KetQua.substring(2) + ' đồng';
        return KetQua;//.substring(0, 1);//.toUpperCase();// + KetQua.substring(1);
    }

    toggleDateFilter() {

        // ["104, 105, 109, 113, 114"]; // đã duyệt/đã giao việc/đã giao hàng/done/còn nợ

        this.query.IDStatus = this.query.IDStatus == '[104, 105, 109, 113, 114]' ? '' : '[104, 105, 109, 113, 114]';
        if (this.query.IDStatus == '[104, 105, 109, 113, 114]') {
            this.query.OrderDate = '';
        }
        else {
            let today = new Date;
            this.query.OrderDate = lib.dateFormat(today.setDate(today.getDate()), 'yyyy-mm-dd');
        }

        this.refresh();
    }    

}
